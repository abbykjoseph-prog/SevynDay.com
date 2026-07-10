"use client";

import { useCallback, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ScrollControls, useScroll } from "@react-three/drei";
import * as THREE from "three";
import { EXPERIENCE, SCENES } from "@/config/experience";
import { clamp01 } from "./math";

type ExperienceProps = { isMobile: boolean };

// ---------------------------------------------------------------------------
// FrameBridge — the single place the master scroll offset is read each frame.
// It writes the raw 0..1 offset (and a resolved scene label) into DOM refs so
// the debug HUD updates without triggering React re-renders.
// ---------------------------------------------------------------------------
function FrameBridge({
  onFrame,
}: {
  onFrame: (p: number, delta: number, state: unknown) => void;
}) {
  const scroll = useScroll();
  useFrame((state, delta) => {
    onFrame(clamp01(scroll.offset), delta, state);
  });
  return null;
}

// ---------------------------------------------------------------------------
// PlaceholderField — a temporary rotating point-sphere so Phase 1 has something
// on screen while the scroll wiring is proven. Replaced by the morphing
// particle system in Phase 2.
// ---------------------------------------------------------------------------
function PlaceholderField() {
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const count = 9000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const top = new THREE.Color(SCENES[0].colorA);
    const bottom = new THREE.Color(SCENES[0].colorB);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      // Fibonacci sphere for even coverage.
      const t = i / count;
      const phi = Math.acos(1 - 2 * t);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = 1.6;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);
      positions.set([x, y, z], i * 3);
      c.copy(bottom).lerp(top, clamp01((y / r) * 0.5 + 0.5));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);

  useFrame((_, delta) => {
    if (pointsRef.current) pointsRef.current.rotation.y += delta * 0.15;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.02}
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

export function Experience({ isMobile }: ExperienceProps) {
  const hudRef = useRef<HTMLDivElement>(null);

  const handleFrame = useCallback((p: number) => {
    const hud = hudRef.current;
    if (!hud) return;
    const scene =
      SCENES.find((s) => p >= s.range[0] && p <= s.range[1])?.label ??
      "— transition —";
    hud.textContent = `p ${p.toFixed(3)}  ·  ${scene}`;
  }, []);

  return (
    <div
      className="fixed inset-0 z-50"
      data-mobile={isMobile}
      style={{ backgroundColor: EXPERIENCE.background }}
    >
      <Canvas
        dpr={EXPERIENCE.dpr}
        gl={{ antialias: true, alpha: false }}
        camera={{ position: [0, 0, 5], fov: 45, near: 0.1, far: 100 }}
        onCreated={({ gl }) => {
          gl.setClearColor(EXPERIENCE.background, 1);
        }}
      >
        <ScrollControls pages={EXPERIENCE.pages} damping={EXPERIENCE.damping}>
          <PlaceholderField />
          <FrameBridge onFrame={handleFrame} />
        </ScrollControls>
      </Canvas>

      {/* Debug progress readout (Phase 1). Removed/keyed off later. */}
      <div
        ref={hudRef}
        className="pointer-events-none fixed left-4 top-4 z-[60] rounded-md border border-white/15 bg-black/50 px-3 py-1.5 font-mono text-xs text-white/80 backdrop-blur"
      >
        p 0.000
      </div>

      {/* Scroll affordance */}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 text-[11px] uppercase tracking-[0.3em] text-white/40">
        scroll
      </div>
    </div>
  );
}
