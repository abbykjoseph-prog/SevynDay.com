"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ScrollControls, useScroll } from "@react-three/drei";
import { EXPERIENCE, SCENES } from "@/config/experience";
import { clamp01, pulse, range01, smoothstep } from "./math";
import { ParticleField } from "./ParticleField";
import { CameraRig } from "./CameraRig";
import { Effects } from "./Effects";
import { Overlay, CONTENT_SCENES } from "./Overlay";

type ExperienceProps = { isMobile: boolean };

// The single place per frame where the master scroll offset is read out to DOM:
// updates the (optional) debug HUD and the fullscreen white-flash overlay.
function FrameBridge({
  onFrame,
}: {
  onFrame: (p: number) => void;
}) {
  const scroll = useScroll();
  useFrame(() => onFrame(clamp01(scroll.offset)));
  return null;
}

// Debug-only (#debug): exposes R3F's synchronous `advance()` and the scroll
// element so a headless/hidden tab (where rAF is paused) can force-render a
// specific scroll offset for screenshot verification. Not mounted in normal use.
function DebugBridge() {
  const advance = useThree((s) => s.advance);
  const scroll = useScroll();
  useEffect(() => {
    (window as unknown as { __exp: { goto(f: number): void } }).__exp = {
      // Jump to scroll offset f and render one settled frame. Sets both the
      // scroll element's scrollTop AND drei's damped `offset` to f so damping is
      // already converged (advance()'s real-clock delta would otherwise crawl).
      goto(f: number) {
        const el = scroll.el;
        el.scrollTop = f * (el.scrollHeight - el.clientHeight);
        scroll.offset = f;
        const t = performance.now();
        advance(t + 16.7);
        advance(t + 33.4);
      },
    };
  }, [advance, scroll]);
  return null;
}

export function Experience({ isMobile }: ExperienceProps) {
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
  const [showHud] = useState(debug);

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

  const handleFrame = useCallback((p: number) => {
    const { range, peak } = EXPERIENCE.flash;
    const flash = flashRef.current;
    if (flash) {
      flash.style.opacity = String(
        Math.min(1, pulse(p, range[0], range[1], peak) * 1.12),
      );
    }

    // Cross-fade each anchor scene's content over its scroll range. Scenes that
    // touch the very top/bottom hold their edge (no fade-in at 0 / fade-out at 1).
    const m = 0.035;
    for (const scene of CONTENT_SCENES) {
      const el = overlayRefs.current[scene.id];
      if (!el) continue;
      const [a, b] = scene.range;
      const fadeIn = a <= 0.001 ? 1 : range01(p, a, a + m);
      const fadeOut = b >= 0.999 ? 1 : 1 - range01(p, b - m, b);
      const fade = smoothstep(Math.min(fadeIn, fadeOut));
      el.style.opacity = String(fade);
      el.style.transform = `translateY(${(1 - fade) * 22}px)`;
      el.style.pointerEvents = fade > 0.6 ? "auto" : "none";
    }

    // The scroll hint fades out once the user leaves the hero.
    const hint = scrollHintRef.current;
    if (hint) hint.style.opacity = String(1 - range01(p, 0.01, 0.06));

    const hud = hudRef.current;
    if (hud) {
      const scene =
        SCENES.find((s) => p >= s.range[0] && p <= s.range[1])?.label ??
        "— transition —";
      hud.textContent = `p ${p.toFixed(3)}  ·  ${scene}`;
    }
  }, []);

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
          <ParticleField count={count} sizeBase={isMobile ? 20 : 16} />
          <CameraRig />
          <FrameBridge onFrame={handleFrame} />
          {debug && <DebugBridge />}
          <Effects isMobile={isMobile} />
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
          p 0.000
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
