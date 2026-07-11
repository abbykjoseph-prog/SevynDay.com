"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ScrollControls, useScroll } from "@react-three/drei";
import { EXPERIENCE, FUNNEL_LABELS, SCENES } from "@/config/experience";
import {
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
import { ProgressProvider, useExperienceProgress } from "./progressDrive";

type ExperienceProps = { isMobile: boolean; reducedMotion: boolean };

// The single place per frame where the master scroll offset is read out to DOM:
// updates the (optional) debug HUD, the fullscreen white-flash overlay, and the
// hero's one-time load-in. `intro` is a frame-accumulated ease-out 0→1 ramp so
// the hero text rise plays once on load and is never reset by scroll.
function FrameBridge({
  onFrame,
}: {
  onFrame: (p: number, intro: number, time: number) => void;
}) {
  const progress = useExperienceProgress();
  const introT = useRef(0);
  const time = useRef(0);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    introT.current = Math.min(introT.current + dt / EXPERIENCE.intro.seconds, 1);
    time.current += dt; // frame-accumulated seconds, for the funnel labels' drift
    onFrame(progress.current, easeOutCubic(introT.current), time.current);
  });
  return null;
}

// Debug-only (#debug): exposes R3F's synchronous `advance()` and the scroll
// element so a headless/hidden tab (where rAF is paused) can force-render a
// specific scroll offset for screenshot verification. Not mounted in normal use.
function DebugBridge() {
  const advance = useThree((s) => s.advance);
  const scroll = useScroll();
  const progress = useExperienceProgress();
  useEffect(() => {
    (window as unknown as { __exp: { goto(f: number): void } }).__exp = {
      // Jump to scroll offset f and render one settled frame. Sets the scroll
      // element's scrollTop, drei's `offset`, AND snaps the shared progress to f
      // (otherwise the rate-limited driver would only crawl toward the target).
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

export function Experience({ isMobile, reducedMotion }: ExperienceProps) {
  // Reduced motion → skip the load-in gather + text rise (formed sphere and text
  // shown directly). In practice reduced-motion users render ReducedExperience
  // upstream instead of this component; this keeps the intro correct regardless.
  const introEnabled = !reducedMotion;

  const hudRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const scrollHintRef = useRef<HTMLDivElement>(null);
  const overlayRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const count = isMobile
    ? EXPERIENCE.particles.mobile
    : EXPERIENCE.particles.desktop;

  const debug = useMemo(
    () =>
      typeof window !== "undefined" &&
      /debug/.test(window.location.hash + window.location.search),
    [],
  );
  // Dev-only progress HUD: renders under `next dev`, tree-shaken out of
  // production builds. (The #debug bridge above stays independent of this.)
  const showHud = process.env.NODE_ENV === "development";

  // R3F's first size measurement inside this position:fixed container comes back
  // as the 300x150 canvas default and the ResizeObserver never re-fires (the
  // fixed element's box never changes). The explicit viewport-unit style on the
  // Canvas gives it a definite box immediately; these synthetic resizes are a
  // belt-and-braces re-measure (setTimeout, not rAF, so they fire in background
  // tabs too).
  useEffect(() => {
    const timers = [0, 150, 400, 900].map((ms) =>
      window.setTimeout(() => window.dispatchEvent(new Event("resize")), ms),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const handleFrame = useCallback(
    (p: number, intro: number, time: number) => {
      // heroIntro eases 0→1 once on load; forced to 1 when the intro is disabled.
      const heroIntro = introEnabled ? intro : 1;

      const { range, peak } = EXPERIENCE.flash;
      const flash = flashRef.current;
      if (flash) {
        flash.style.opacity = String(
          Math.min(1, pulse(p, range[0], range[1], peak) * 1.12),
        );
      }

      // Cross-fade each anchor scene's content over its scroll range. Scenes that
      // touch the very top/bottom hold their edge (no fade-in at 0 / out at 1).
      const m = 0.035;
      for (const scene of CONTENT_SCENES) {
        const el = overlayRefs.current[scene.id];
        if (!el) continue;
        const [a, b] = scene.range;
        const fadeIn = a <= 0.001 ? 1 : range01(p, a, a + m);
        const fadeOut = b >= 0.999 ? 1 : 1 - range01(p, b - m, b);
        const fade = smoothstep(Math.min(fadeIn, fadeOut));
        // The hero additionally plays the one-time load-in: fade + a soft rise
        // (~risePx), in step with the particle gather.
        const isHero = scene.id === "sphere";
        const rise = isHero ? (1 - heroIntro) * EXPERIENCE.intro.risePx : 0;
        el.style.opacity = String(isHero ? fade * heroIntro : fade);
        el.style.transform = `translateY(${(1 - fade) * 22 + rise}px)`;
        // The block itself stays click-through (inherits pointer-events:none from
        // the overlay root) so the wheel reaches the scroll controller. Only the
        // button wrapper becomes interactive, and only while the scene is visible.
        const cta = el.querySelector<HTMLElement>("[data-cta]");
        if (cta) cta.style.pointerEvents = fade > 0.6 ? "auto" : "none";
      }

      // Funnel scene: reveal the three flat labels SEQUENTIALLY by scroll (each
      // fully in at its config `reveal` p), fading + rising ~12px, plus a very
      // subtle continuous drift so they feel alive (translate only — no rotate).
      // All fade out together as the exit transition begins (~0.175–0.215).
      const funnelOut = 1 - range01(p, 0.175, 0.215);
      for (let i = 0; i < FUNNEL_LABELS.length; i++) {
        const el = overlayRefs.current[`funnel-${i}`];
        if (!el) continue;
        const reveal = FUNNEL_LABELS[i].reveal;
        const fadeIn = smoothstep(range01(p, reveal - 0.02, reveal));
        const op = Math.min(fadeIn, smoothstep(funnelOut));
        const rise = (1 - fadeIn) * 12; // soft upward rise as it comes in
        const driftX = Math.sin(time * 0.6 + i * 2.1) * 4;
        const driftY = Math.cos(time * 0.5 + i * 2.1) * 3;
        el.style.opacity = String(op);
        el.style.transform = `translate(${driftX}px, ${rise + driftY}px)`;
      }

      // Starfield scene: the centered statement fades in as the scene enters and
      // out as it leaves, with a subtle scale for impact.
      const star = overlayRefs.current["starfield"];
      if (star) {
        const f = windowFade(p, 0.38, 0.5, 0.035);
        star.style.opacity = String(f);
        star.style.transform = `scale(${0.965 + 0.035 * f})`;
      }

      // The scroll hint fades out once the user leaves the hero.
      const hint = scrollHintRef.current;
      if (hint) hint.style.opacity = String(1 - range01(p, 0.01, 0.06));

      const hud = hudRef.current;
      if (hud) {
        const scene =
          SCENES.find((s) => p >= s.range[0] && p <= s.range[1])?.label ??
          "— transition —";
        hud.textContent = `p ${p.toFixed(2)}  ·  ${scene}`;
      }
    },
    [introEnabled],
  );

  return (
    <div
      className="fixed inset-0 z-50"
      data-mobile={isMobile}
      style={{ backgroundColor: EXPERIENCE.background }}
    >
      <Canvas
        flat
        dpr={EXPERIENCE.dpr}
        // Explicit viewport-unit box + offsetSize measuring: reliable inside a
        // position:fixed parent, where getBoundingClientRect can report the
        // 300x150 default and never self-correct otherwise.
        style={{ width: "100vw", height: "100vh", display: "block" }}
        resize={{ offsetSize: true }}
        gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 5.4], fov: 45, near: 0.1, far: 100 }}
        onCreated={({ gl }) => gl.setClearColor(EXPERIENCE.background, 1)}
      >
        <ScrollControls pages={EXPERIENCE.pages} damping={EXPERIENCE.damping}>
          {/* ProgressProvider mounts its driver first, then feeds one smoothed,
              rate-limited progress value to every scene below. */}
          <ProgressProvider>
            <ParticleField
              count={count}
              sizeBase={isMobile ? 20 : 16}
              intro={introEnabled}
            />
            <SceneExtras />
            <CameraRig />
            <FrameBridge onFrame={handleFrame} />
            {debug && <DebugBridge />}
            <Effects isMobile={isMobile} />
          </ProgressProvider>
        </ScrollControls>
      </Canvas>

      {/* HTML content overlays for the anchor scenes. */}
      <Overlay blockRefs={overlayRefs} />

      {/* Fullscreen white-flash blowout (scene 7). Additive-feeling via bloom +
          this plane; opacity driven per frame from the scroll offset. */}
      <div
        ref={flashRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[55] bg-white"
        style={{ opacity: 0, mixBlendMode: "screen" }}
      />

      {/* Debug progress readout — only with #debug in the URL. */}
      {showHud && (
        <div
          ref={hudRef}
          className="pointer-events-none fixed left-4 top-4 z-[60] rounded-md border border-white/15 bg-black/50 px-3 py-1.5 font-mono text-xs text-white/80 backdrop-blur"
        >
          p 0.00
        </div>
      )}

      {/* Scroll affordance — fades out once past the hero. */}
      <div
        ref={scrollHintRef}
        className="pointer-events-none fixed bottom-6 left-1/2 z-[54] -translate-x-1/2 text-[11px] uppercase tracking-[0.3em] text-white/40"
      >
        scroll
      </div>
    </div>
  );
}
