"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ScrollControls, useScroll } from "@react-three/drei";
import {
  EXPERIENCE,
  FUNNEL_STYLE,
  PROGRESS_DOTS,
  PROGRESS_STAGES,
  SCENES,
} from "@/config/experience";
import {
  clamp01,
  easeOutCubic,
  pulse,
  range01,
  smoothstep,
  windowFade,
} from "./math";
import { ParticleField } from "./ParticleField";
import { CameraRig } from "./CameraRig";
import { Effects } from "./Effects";
import { SceneExtras } from "./SceneExtras";
import { Overlay, CONTENT_SCENES } from "./Overlay";
import { ProgressDots } from "./ProgressDots";
import { PlatformPanel, PlaceholderSections } from "./SiteSections";
import { ProgressProvider, useExperienceProgress } from "./progressDrive";

type ExperienceProps = { isMobile: boolean; reducedMotion: boolean };
type Phase = "scrub" | "outro" | "released";

// The single place per frame where the master scroll offset is read out to DOM:
// updates the (optional) debug HUD, the fullscreen white-flash overlay, the
// hero's one-time load-in, and the finale wordmark. `intro` is a
// frame-accumulated ease-out 0→1 ramp so the hero text rise plays once.
function FrameBridge({
  onFrame,
}: {
  onFrame: (p: number, intro: number) => void;
}) {
  const progress = useExperienceProgress();
  const introT = useRef(0);
  useFrame((_, delta) => {
    introT.current = Math.min(
      introT.current + Math.min(delta, 0.05) / EXPERIENCE.intro.seconds,
      1,
    );
    onFrame(progress.current, easeOutCubic(introT.current));
  });
  return null;
}

// Debug-only (#debug): exposes R3F's synchronous `advance()` so a headless tab
// (where rAF is paused) can force-render a specific scroll offset for
// screenshot verification. Not mounted in normal use.
function DebugBridge() {
  const advance = useThree((s) => s.advance);
  const scroll = useScroll();
  const progress = useExperienceProgress();
  useEffect(() => {
    (window as unknown as { __exp: { goto(f: number): void } }).__exp = {
      goto(f: number) {
        const el = scroll.el;
        el.scrollTop = f * (el.scrollHeight - el.clientHeight);
        scroll.offset = f;
        progress.current = f;
        const t = performance.now();
        advance(t + 16.7);
        advance(t + 33.4);
      },
    };
  }, [advance, scroll, progress]);
  return null;
}

// Exposes drei's scroll element to the DOM layer so a progress-dot click can
// drive a smooth native scroll to a stage. (Phase-1 free-scrub navigation; the
// snap model replaces this in Phase 2.)
function ScrollElCapture({
  elRef,
}: {
  elRef: MutableRefObject<HTMLElement | null>;
}) {
  const scroll = useScroll();
  useEffect(() => {
    elRef.current = scroll.el;
  }, [elRef, scroll]);
  return null;
}

export function Experience({ isMobile, reducedMotion }: ExperienceProps) {
  const introEnabled = !reducedMotion;

  // scrub  → scroll-scrubbed WebGL scenes (ScrollControls drives everything)
  // outro  → triggered, self-playing: SEVYNDAY exits up, platform panel rises
  // released → pinned experience handed off to normal document scrolling
  const [phase, setPhase] = useState<Phase>("scrub");
  const phaseRef = useRef<Phase>("scrub");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const [webglActive, setWebglActive] = useState(true);

  const hudRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const scrollHintRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const overlayRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const latestP = useRef(0); // latest progress, read by the outro trigger
  const scrollElRef = useRef<HTMLElement | null>(null);

  // Clicking a progress dot navigates to that stage. Phase 1: a smooth native
  // scroll of the drei scroll element (which the progress driver follows).
  // Phase 2 replaces this with the snap controller's goToStage.
  const onStageClick = useCallback((index: number) => {
    const el = scrollElRef.current;
    if (!el) return;
    const target = PROGRESS_STAGES[index]?.at ?? 0;
    el.scrollTo({
      top: target * (el.scrollHeight - el.clientHeight),
      behavior: "smooth",
    });
  }, []);

  const count = isMobile
    ? EXPERIENCE.particles.mobile
    : EXPERIENCE.particles.desktop;

  const debug = useMemo(
    () =>
      typeof window !== "undefined" &&
      /debug/.test(window.location.hash + window.location.search),
    [],
  );
  const showHud = process.env.NODE_ENV === "development";

  // R3F's first size measurement inside a fixed/zero-size container can report
  // the 300x150 default; the viewport-unit Canvas style + these synthetic
  // resizes force a correct re-measure.
  useEffect(() => {
    const timers = [0, 150, 400, 900].map((ms) =>
      window.setTimeout(() => window.dispatchEvent(new Event("resize")), ms),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  // --- Outro trigger: a scroll-down at the orbital finale starts the outro. ---
  // Armed only during scrub, only once progress has actually reached the orbital
  // scene (triggerThreshold), and guarded against double-firing (the listeners
  // are torn down the instant we leave scrub).
  useEffect(() => {
    if (phase !== "scrub") return;
    const fire = () => {
      if (phaseRef.current !== "scrub") return;
      if (latestP.current < EXPERIENCE.outro.triggerThreshold) return;
      setPhase("outro");
    };
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 0) fire();
    };
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", " ", "Spacebar"].includes(e.key)) fire();
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const cy = e.touches[0]?.clientY ?? touchY;
      if (touchY - cy > 8) fire();
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [phase]);

  // --- Outro self-play → release. The wordmark/panel transforms are CSS
  // transitions driven by `phase` in JSX; here we just release after the longer
  // of the two finishes. ---
  useEffect(() => {
    if (phase !== "outro") return;
    const total =
      Math.max(EXPERIENCE.outro.wordmarkMs, EXPERIENCE.outro.panelMs) + 80;
    const t = window.setTimeout(() => setPhase("released"), total);
    return () => window.clearTimeout(t);
  }, [phase]);

  // --- Body scroll: locked while pinned (scrub/outro) so only ScrollControls
  // scrubs; unlocked on release so the document scrolls normally. ---
  useEffect(() => {
    const lock = phase !== "released";
    document.documentElement.style.overflow = lock ? "hidden" : "";
    document.body.style.overflow = lock ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [phase]);

  // --- After release: fade the WebGL background out over the first bit of
  // scrolling, then pause the render once it is off-screen. ---
  useEffect(() => {
    if (phase !== "released") return;
    const onScroll = () => {
      const fadeDist = window.innerHeight * EXPERIENCE.outro.bgFadeVh || 1;
      const op = clamp01(1 - window.scrollY / fadeDist);
      if (bgRef.current) bgRef.current.style.opacity = String(op);
      setWebglActive(op > 0.002); // no-op re-render when unchanged
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [phase]);

  const handleFrame = useCallback(
    (p: number, intro: number) => {
      latestP.current = p;
      const heroIntro = introEnabled ? intro : 1;

      const { range, peak } = EXPERIENCE.flash;
      const flash = flashRef.current;
      if (flash) {
        flash.style.opacity = String(
          Math.min(1, pulse(p, range[0], range[1], peak) * 1.12),
        );
      }

      // Cross-fade each anchor scene's content over its scroll range.
      const m = 0.035;
      for (const scene of CONTENT_SCENES) {
        const el = overlayRefs.current[scene.id];
        if (!el) continue;
        const [a, b] = scene.range;
        const fadeIn = a <= 0.001 ? 1 : range01(p, a, a + m);
        const fadeOut = b >= 0.999 ? 1 : 1 - range01(p, b - m, b);
        const fade = smoothstep(Math.min(fadeIn, fadeOut));
        const isHero = scene.id === "sphere";
        const rise = isHero ? (1 - heroIntro) * EXPERIENCE.intro.risePx : 0;
        el.style.opacity = String(isHero ? fade * heroIntro : fade);
        el.style.transform = `translateY(${(1 - fade) * 22 + rise}px)`;
        const cta = el.querySelector<HTMLElement>("[data-cta]");
        if (cta) cta.style.pointerEvents = fade > 0.6 ? "auto" : "none";
      }

      // Funnel labels: one stack, fade in together + glide L→R.
      const funnelIn = smoothstep(range01(p, 0.14, 0.16));
      const funnelOut = smoothstep(1 - range01(p, 0.175, 0.215));
      const stack = overlayRefs.current["funnel-stack"];
      if (stack) {
        stack.style.opacity = String(Math.min(funnelIn, funnelOut));
        const glideX =
          FUNNEL_STYLE.startX + range01(p, 0.14, 0.215) * FUNNEL_STYLE.glide;
        const rise = (1 - funnelIn) * 10;
        stack.style.transform = `translate(calc(-50% + ${glideX.toFixed(2)}px), ${rise.toFixed(2)}px)`;
      }

      // Starfield statement: fade in/out with the scene.
      const star = overlayRefs.current["starfield"];
      if (star) {
        const f = windowFade(p, 0.38, 0.5, 0.035);
        star.style.opacity = String(f);
        star.style.transform = `scale(${0.965 + 0.035 * f})`;
      }

      // Finale: SEVYNDAY fades in over the orbital scene (scrub only; the outro
      // then takes it over via the phase-driven CSS transform).
      if (phaseRef.current === "scrub") {
        const wm = wordmarkRef.current;
        if (wm) wm.style.opacity = String(smoothstep(range01(p, 0.9, 0.95)));
      }

      // Progress dots: highlight the current CONTENT stage. `stageF` is a
      // fractional stage index (eased between the stage anchors), so the
      // highlight glides from one dot to the next across transition scenes.
      let stageF = PROGRESS_STAGES.length - 1;
      if (p <= PROGRESS_STAGES[0].at) {
        stageF = 0;
      } else {
        for (let i = 0; i < PROGRESS_STAGES.length - 1; i++) {
          if (p < PROGRESS_STAGES[i + 1].at) {
            const span = PROGRESS_STAGES[i + 1].at - PROGRESS_STAGES[i].at;
            stageF = i + smoothstep((p - PROGRESS_STAGES[i].at) / span);
            break;
          }
        }
      }
      for (let i = 0; i < PROGRESS_STAGES.length; i++) {
        const el = overlayRefs.current[`stage-${i}`];
        if (!el) continue;
        const a = clamp01(1 - Math.abs(i - stageF)); // this dot's activeness
        el.style.transform = `scale(${(1 + (PROGRESS_DOTS.activeScale - 1) * a).toFixed(3)})`;
        const active = el.querySelector<HTMLElement>("[data-active]");
        if (active) active.style.opacity = a.toFixed(3);
      }

      const hint = scrollHintRef.current;
      if (hint) hint.style.opacity = String(1 - range01(p, 0.01, 0.06));

      const hud = hudRef.current;
      if (hud) {
        const scene =
          SCENES.find((s) => p >= s.range[0] && p <= s.range[1])?.label ??
          "— transition —";
        hud.textContent = `p ${p.toFixed(2)}  ·  ${scene}  ·  ${phaseRef.current}`;
      }
    },
    [introEnabled],
  );

  const { wordmarkMs, panelMs } = EXPERIENCE.outro;

  return (
    <div
      data-mobile={isMobile}
      style={{ backgroundColor: EXPERIENCE.background }}
    >
      {/* WebGL background — fixed; fades out + pauses after release. Interactive
          (for ScrollControls) only while scrubbing. */}
      <div
        ref={bgRef}
        className="fixed inset-0 z-0"
        style={{
          backgroundColor: EXPERIENCE.background,
          pointerEvents: phase === "scrub" ? "auto" : "none",
        }}
      >
        <Canvas
          flat
          frameloop={webglActive ? "always" : "never"}
          dpr={EXPERIENCE.dpr}
          style={{ width: "100vw", height: "100vh", display: "block" }}
          resize={{ offsetSize: true }}
          gl={{
            antialias: false,
            alpha: false,
            powerPreference: "high-performance",
          }}
          camera={{ position: [0, 0, 5.4], fov: 45, near: 0.1, far: 100 }}
          onCreated={({ gl }) => gl.setClearColor(EXPERIENCE.background, 1)}
        >
          <ScrollControls
            enabled={phase === "scrub"}
            pages={EXPERIENCE.pages}
            damping={EXPERIENCE.damping}
          >
            <ProgressProvider>
              <ParticleField
                count={count}
                sizeBase={isMobile ? 20 : 16}
                intro={introEnabled}
              />
              <SceneExtras />
              <CameraRig />
              <FrameBridge onFrame={handleFrame} />
              <ScrollElCapture elRef={scrollElRef} />
              {debug && <DebugBridge />}
              <Effects isMobile={isMobile} />
            </ProgressProvider>
          </ScrollControls>
        </Canvas>
      </div>

      {/* Pinned-phase DOM overlays — removed once released. */}
      {phase !== "released" && (
        <>
          <Overlay blockRefs={overlayRefs} />

          <div
            ref={flashRef}
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[55] bg-white"
            style={{ opacity: 0, mixBlendMode: "screen" }}
          />

          {/* SEVYNDAY finale wordmark. Opacity is driven per frame in scrub;
              transform/transition are phase-driven so React never resets them. */}
          <div
            ref={wordmarkRef}
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[45] flex items-center justify-center will-change-transform"
            style={{
              opacity: phase === "outro" ? 1 : 0,
              transform:
                phase === "scrub" ? "translateY(0)" : "translateY(-115vh)",
              transition:
                phase === "outro"
                  ? `transform ${wordmarkMs}ms cubic-bezier(0.6,0,0.75,0.1)`
                  : undefined,
            }}
          >
            <span
              className="font-display text-6xl font-bold tracking-tight text-white sm:text-8xl"
              style={{
                textShadow:
                  "0 0 22px rgba(255,255,255,0.5), 0 0 60px rgba(255,255,255,0.3), 0 0 120px rgba(255,255,255,0.15)",
              }}
            >
              SEVYNDAY
            </span>
          </div>

          <div
            ref={scrollHintRef}
            className="pointer-events-none fixed bottom-6 left-1/2 z-[54] -translate-x-1/2 text-[11px] uppercase tracking-[0.3em] text-white/40"
          >
            scroll
          </div>
        </>
      )}

      {/* Scroll-progress dots — present throughout (clickable to jump between
          stages / replay); smaller + dimmer once handed off to normal scroll. */}
      <ProgressDots
        blockRefs={overlayRefs}
        isMobile={isMobile}
        visible
        dimmed={phase === "released"}
        onStageClick={onStageClick}
      />

      {/* Dev-only progress HUD. */}
      {showHud && (
        <div
          ref={hudRef}
          className="pointer-events-none fixed left-4 top-4 z-[60] rounded-md border border-white/15 bg-black/50 px-3 py-1.5 font-mono text-xs text-white/80 backdrop-blur"
        >
          p 0.00
        </div>
      )}

      {/* Released content — normal document flow. Below-fold during scrub, rises
          in during the outro (CSS transition), then normal-scrolls after
          release. z-10 sits above the fading background. */}
      <div
        ref={contentRef}
        className="relative z-10 will-change-transform"
        style={{
          transform: phase === "scrub" ? "translateY(100vh)" : "translateY(0)",
          transition:
            phase === "outro"
              ? `transform ${panelMs}ms cubic-bezier(0.16,1,0.3,1)`
              : undefined,
        }}
      >
        <PlatformPanel />
        <PlaceholderSections />
      </div>
    </div>
  );
}
