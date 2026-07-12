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
import {
  EXPERIENCE,
  FUNNEL_STYLE,
  PROGRESS_DOTS,
  PROGRESS_STAGES,
  SCENES,
} from "@/config/experience";
import {
  clamp01,
  easeInOutCubic,
  easeOutCubic,
  lerp,
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

// The six CONTENT stages' settled progress values (the snap targets). One
// gesture tweens `progress` between adjacent targets; the Wave Terrain → Orbital
// step spans well+flash, so it plays as one long atomic climax run.
const STAGE_TARGETS = PROGRESS_STAGES.map((s) => s.at);
const N_STAGES = STAGE_TARGETS.length;

type SnapState = {
  value: number; // current progress 0..1 (mirrored into progress.current)
  stage: number; // settled / target stage index
  animating: boolean;
  lastArrive: number; // performance.now() of last arrival (input cooldown)
  // The active tween is EITHER a normal single eased segment OR the choreographed
  // climax (a single CONTINUOUS monotone-Hermite curve through the sub-beats).
  climax: boolean;
  // normal single eased segment:
  from: number;
  to: number;
  dur: number; // seconds
  t: number; // 0..1
  // climax keyframed path (continuous velocity, no per-beat dwell):
  kt: number[]; // cumulative keyframe times (s)
  kp: number[]; // keyframe progress values
  km: number[]; // keyframe tangents dp/dt (0 at the ends → ease-in / ease-out)
  kElapsed: number;
  kDur: number;
};

// Span-scaled per-transition duration (normal steps, reverse climax, multi-stage
// dot jumps), clamped. Long enough that the morph is clearly watchable.
function snapDurationSec(span: number): number {
  const { transitionMs, minMs, maxMs, refSpan } = EXPERIENCE.snap;
  const ms = Math.min(
    maxMs,
    Math.max(minMs, (transitionMs * Math.abs(span)) / refSpan),
  );
  return ms / 1000;
}

// Monotone cubic-Hermite tangents for the climax keyframes: 0 at the endpoints
// (so the whole run eases IN at the start and OUT at the end) and the harmonic
// mean of the neighbouring secants at each interior keyframe — which guarantees
// a monotone, CONTINUOUS-velocity curve, i.e. no dwell/freeze between sub-beats.
function monotoneTangents(ts: number[], ps: number[]): number[] {
  const n = ts.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    d.push((ps[i + 1] - ps[i]) / (ts[i + 1] - ts[i]));
  }
  const m = new Array<number>(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const a = d[i - 1];
    const b = d[i];
    m[i] = a > 0 && b > 0 ? 2 / (1 / a + 1 / b) : 0;
  }
  return m;
}

// Evaluate the climax curve at s.kElapsed seconds (cubic Hermite in the segment).
function climaxValue(s: SnapState): number {
  const { kt, kp, km, kElapsed } = s;
  let i = 0;
  while (i < kt.length - 2 && kElapsed > kt[i + 1]) i++;
  const h = kt[i + 1] - kt[i];
  const u = h > 0 ? Math.min(1, Math.max(0, (kElapsed - kt[i]) / h)) : 1;
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  return h00 * kp[i] + h10 * h * km[i] + h01 * kp[i + 1] + h11 * h * km[i + 1];
}

// Advances the active snap tween each frame and mirrors it into the shared
// progress ref. The climax is ONE continuous monotone-Hermite curve (no per-beat
// freeze); normal steps are a single eased segment. Mounted first inside
// ProgressProvider so scene consumers read the fresh value the same frame.
function SnapDriver({ snap }: { snap: MutableRefObject<SnapState> }) {
  const progress = useExperienceProgress();
  useFrame((_, delta) => {
    const s = snap.current;
    if (s.animating) {
      const dt = Math.min(delta, 0.05);
      if (s.climax) {
        s.kElapsed = Math.min(s.kElapsed + dt, s.kDur);
        s.value = climaxValue(s);
        if (s.kElapsed >= s.kDur) {
          s.value = s.kp[s.kp.length - 1];
          s.animating = false;
          s.lastArrive = performance.now();
        }
      } else {
        s.t = Math.min(s.t + dt / s.dur, 1);
        s.value = lerp(s.from, s.to, easeInOutCubic(s.t));
        if (s.t >= 1) {
          s.value = s.to;
          s.animating = false;
          s.lastArrive = performance.now();
        }
      }
    }
    progress.current = s.value;
  });
  return null;
}

// The single place per frame where the master progress is read out to DOM:
// updates the (optional) debug HUD, the white-flash overlay, the hero's one-time
// load-in, the finale wordmark, and the progress dots. `intro` is a
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
// (where rAF is paused) can force-render a specific progress value. It snaps the
// snap state to that value (no tween) so the scenes render it immediately.
function DebugBridge({ snap }: { snap: MutableRefObject<SnapState> }) {
  const advance = useThree((s) => s.advance);
  const progress = useExperienceProgress();
  useEffect(() => {
    (window as unknown as { __exp: { goto(f: number): void } }).__exp = {
      goto(f: number) {
        const s = snap.current;
        s.value = f;
        s.animating = false;
        s.climax = false;
        s.t = 1;
        // Nearest stage (for the dots / logic).
        let nearest = 0;
        let best = Infinity;
        STAGE_TARGETS.forEach((t, i) => {
          const d = Math.abs(t - f);
          if (d < best) {
            best = d;
            nearest = i;
          }
        });
        s.stage = nearest;
        progress.current = f;
        const now = performance.now();
        advance(now + 16.7);
        advance(now + 33.4);
      },
    };
  }, [advance, progress, snap]);
  return null;
}

export function Experience({ isMobile, reducedMotion }: ExperienceProps) {
  // State persistence: the resolved END-STATE (SEVYNDAY parked, orbital settled,
  // platform panel at the top of the normal content) is the default return
  // point for BACK/FORWARD navigation. Only a genuine reload replays from Hero.
  // Navigation Timing API: back_forward → start at the end-state; reload / fresh
  // navigate → play the full experience from Hero. (Computed once, on mount.)
  const startAtEnd = useMemo(() => {
    if (typeof performance === "undefined") return false;
    const nav = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;
    return nav?.type === "back_forward";
  }, []);
  // Skip the hero load-in gather when we jump straight to the end (no replay).
  const introEnabled = !reducedMotion && !startAtEnd;

  // scrub  → snap-to-section navigation (one gesture = one stage)
  // outro  → triggered, self-playing finale (SEVYNDAY parks, panel rises)
  // released → handed off to normal document scrolling
  const initialPhase: Phase = startAtEnd ? "released" : "scrub";
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const phaseRef = useRef<Phase>(initialPhase);
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

  // The shared progress ref (written by SnapDriver, read by every scene).
  const progressRef = useRef(0);
  // The snap tween state — the source of truth for where we are / heading.
  // back_forward starts settled on Orbital (the end-state); otherwise Hero.
  const initialStage = startAtEnd ? N_STAGES - 1 : 0;
  const snap = useRef<SnapState>({
    value: STAGE_TARGETS[initialStage],
    stage: initialStage,
    animating: false,
    lastArrive: 0,
    climax: false,
    from: STAGE_TARGETS[initialStage],
    to: STAGE_TARGETS[initialStage],
    dur: 1,
    t: 1,
    kt: [],
    kp: [],
    km: [],
    kElapsed: 0,
    kDur: 1,
  });

  // Input is locked while a transition plays, plus a short cooldown after landing
  // (absorbs trackpad momentum so one flick = exactly one stage).
  const locked = useCallback(() => {
    const s = snap.current;
    return (
      s.animating ||
      performance.now() - s.lastArrive < EXPERIENCE.snap.lockMs
    );
  }, []);

  // Tween progress to a stage target (used by scroll gestures + dot clicks).
  // A forward move that ENDS on Orbital plays the choreographed climax beats;
  // everything else is a single span-scaled eased segment.
  const goToStage = useCallback((index: number) => {
    const s = snap.current;
    const target = Math.max(0, Math.min(N_STAGES - 1, index));
    if (target === s.stage && !s.animating) return;
    const toP = STAGE_TARGETS[target];
    if (target === N_STAGES - 1 && target > s.stage) {
      // Wave Terrain → Orbital climax: gather/form → string → flare → expand,
      // played as ONE continuous monotone-Hermite curve through the sub-beat
      // checkpoints (velocity stays continuous across beats — no dwell/freeze,
      // and the flash is traversed quickly so it never holds on full white).
      const kt = [0];
      const kp = [s.value];
      let acc = 0;
      for (const b of EXPERIENCE.snap.climax) {
        acc += b.ms / 1000;
        kt.push(acc);
        kp.push(b.p);
      }
      kp[kp.length - 1] = toP; // land exactly on Orbital
      s.climax = true;
      s.kt = kt;
      s.kp = kp;
      s.km = monotoneTangents(kt, kp);
      s.kElapsed = 0;
      s.kDur = acc;
    } else {
      // Single eased segment. An adjacent-stage step may override its duration
      // (EXPERIENCE.snap.overrideMs by gap); otherwise the span-scaled default.
      const gap = Math.min(s.stage, target);
      const override =
        Math.abs(target - s.stage) === 1
          ? EXPERIENCE.snap.overrideMs[gap]
          : null;
      s.climax = false;
      s.from = s.value;
      s.to = toP;
      s.dur =
        override != null ? override / 1000 : snapDurationSec(toP - s.value);
      s.t = 0;
    }
    s.animating = true;
    s.stage = target;
  }, []);

  const startOutro = useCallback(() => {
    if (phaseRef.current !== "scrub") return;
    if (snap.current.animating) return;
    setPhase("outro");
  }, []);

  // One gesture = one stage. At orbital, a forward gesture starts the outro.
  const step = useCallback(
    (dir: number) => {
      if (locked()) return;
      const s = snap.current;
      if (s.stage >= N_STAGES - 1 && dir > 0) {
        startOutro();
        return;
      }
      if (s.stage <= 0 && dir < 0) return;
      goToStage(s.stage + dir);
    },
    [locked, goToStage, startOutro],
  );

  // Re-enter the pinned experience from the normal site (dot click after handoff)
  // — reset the released chrome and tween to the chosen stage.
  const reenter = useCallback(
    (index: number) => {
      window.scrollTo(0, 0);
      if (bgRef.current) bgRef.current.style.opacity = "1";
      setWebglActive(true);
      goToStage(index);
      setPhase("scrub");
    },
    [goToStage],
  );

  // Home: the parked SEVYNDAY logo returns to the resolved end-state INSTANTLY
  // (no replay) — snap to Orbital + release, scrolled to the top.
  const goHome = useCallback(() => {
    const s = snap.current;
    s.value = STAGE_TARGETS[N_STAGES - 1];
    s.stage = N_STAGES - 1;
    s.climax = false;
    s.t = 1;
    s.animating = false;
    window.scrollTo(0, 0);
    if (bgRef.current) bgRef.current.style.opacity = "1";
    setWebglActive(true);
    setPhase("released");
  }, []);

  // Clicking a progress dot navigates to that stage using the SAME smooth tween
  // as scrolling (never a hard teleport). The Orbital dot plays the whole climax.
  const onStageClick = useCallback(
    (index: number) => {
      if (phaseRef.current === "released") {
        reenter(index);
        return;
      }
      if (phaseRef.current !== "scrub") return;
      if (locked()) return;
      goToStage(index);
    },
    [locked, goToStage, reenter],
  );

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

  // --- Snap gesture input: wheel / keys / swipe. Active only while scrubbing.
  // Normalized so a mouse-wheel notch and a trackpad flick both = one stage; the
  // lock (transition + cooldown) prevents a flick skipping stages. Wheel/touch
  // default is prevented so the page never scrolls under the pinned experience.
  useEffect(() => {
    if (phase !== "scrub") return;
    const { wheelThreshold, swipeThreshold } = EXPERIENCE.snap;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (Math.abs(e.deltaY) < wheelThreshold) return;
      step(e.deltaY > 0 ? 1 : -1);
    };
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", " ", "Spacebar"].includes(e.key)) {
        e.preventDefault();
        step(1);
      } else if (["ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        step(-1);
      }
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault(); // stop native scroll / pull-to-refresh
    };
    const onTouchEnd = (e: TouchEvent) => {
      const endY = e.changedTouches[0]?.clientY ?? touchY;
      const dy = touchY - endY; // finger up (dy>0) = advance
      if (Math.abs(dy) > swipeThreshold) step(dy > 0 ? 1 : -1);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [phase, step]);

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

  // --- Body scroll: locked while pinned (scrub/outro) so only the snap model
  // drives the experience; unlocked on release so the document scrolls normally.
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
        hud.textContent = `p ${p.toFixed(2)}  ·  ${scene}  ·  ${phaseRef.current}  ·  s${snap.current.stage}`;
      }
    },
    [introEnabled],
  );

  const { wordmarkMs, panelMs, parkScale, parkX, parkY } = EXPERIENCE.outro;
  // Parked-logo transform: shrink + move SEVYNDAY's center from screen-center to
  // (parkX, parkY) px (top-left). vw/vh keep it correct on any viewport.
  const parkedLogo = `translate(calc(${parkX}px - 50vw), calc(${parkY}px - 50vh)) scale(${parkScale})`;

  return (
    <div
      data-mobile={isMobile}
      style={{ backgroundColor: EXPERIENCE.background }}
    >
      {/* WebGL background — fixed; fades out + pauses after release. Purely a
          background (gestures are window listeners), so it never intercepts. */}
      <div
        ref={bgRef}
        className="pointer-events-none fixed inset-0 z-0"
        style={{ backgroundColor: EXPERIENCE.background }}
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
          <ProgressProvider progress={progressRef}>
            {/* SnapDriver first: writes progress from the snap tween before
                any consumer reads it this frame. */}
            <SnapDriver snap={snap} />
            <ParticleField
              count={count}
              sizeBase={isMobile ? 20 : 16}
              intro={introEnabled}
            />
            <SceneExtras />
            <CameraRig />
            <FrameBridge onFrame={handleFrame} />
            {debug && <DebugBridge snap={snap} />}
            <Effects isMobile={isMobile} />
          </ProgressProvider>
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

          <div
            ref={scrollHintRef}
            className="pointer-events-none fixed bottom-6 left-1/2 z-[54] -translate-x-1/2 text-[11px] uppercase tracking-[0.3em] text-white/40"
          >
            scroll
          </div>
        </>
      )}

      {/* Scroll-progress dots — scoped to the ANIMATION only (scrub). They fade
          out on the finale handoff and never float over the normal content
          sections below (Features / Pricing / Footer). */}
      <ProgressDots
        blockRefs={overlayRefs}
        isMobile={isMobile}
        visible={phase === "scrub"}
        dimmed={false}
        onStageClick={onStageClick}
      />

      {/* SEVYNDAY — centered + large during the experience (opacity driven per
          frame in scrub); on the outro it shrinks and moves to a PARKED top-left
          site logo, and stays there over the normal content (persistent; the
          home-nav click is wired in Phase 4). Rendered in every phase. */}
      <div
        ref={wordmarkRef}
        aria-hidden={phase !== "released"}
        className="pointer-events-none fixed inset-0 z-[57] flex items-center justify-center will-change-transform"
        style={{ opacity: phase === "scrub" ? 0 : 1 }}
      >
        <span
          onClick={phase === "released" ? goHome : undefined}
          onKeyDown={
            phase === "released"
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    goHome();
                  }
                }
              : undefined
          }
          role={phase === "released" ? "button" : undefined}
          tabIndex={phase === "released" ? 0 : undefined}
          aria-label={phase === "released" ? "SevynDay — home" : undefined}
          className="font-display text-6xl font-bold tracking-tight text-white outline-none will-change-transform focus-visible:ring-2 focus-visible:ring-white/60 sm:text-8xl"
          style={{
            textShadow:
              "0 0 22px rgba(255,255,255,0.5), 0 0 60px rgba(255,255,255,0.3), 0 0 120px rgba(255,255,255,0.15)",
            transformOrigin: "center",
            transform: phase === "scrub" ? "none" : parkedLogo,
            transition:
              phase === "outro"
                ? `transform ${wordmarkMs}ms cubic-bezier(0.5,0,0.2,1)`
                : undefined,
            pointerEvents: phase === "released" ? "auto" : "none",
            cursor: phase === "released" ? "pointer" : "default",
          }}
        >
          SEVYNDAY
        </span>
      </div>

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
