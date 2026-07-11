"use client";

import {
  createContext,
  useContext,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { useFrame } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";
import * as THREE from "three";
import { EXPERIENCE } from "@/config/experience";
import { clamp01 } from "./math";
import { resolveResistance } from "./progress";

// The ONE progress value every scene animation reads. It is a smoothed,
// speed-capped follow of drei's `scroll.offset`:
//   1. damp toward the target (removes the raw scroll's chunkiness), then
//   2. clamp the per-frame step to `maxSpeed * dt`, so a scrollbar slam or a
//      fast flick can't jump the animation — it catches up smoothly.
// Consumers read `useExperienceProgress().current` inside their own useFrame.

const ProgressContext = createContext<MutableRefObject<number> | null>(null);

export function useExperienceProgress(): MutableRefObject<number> {
  const ctx = useContext(ProgressContext);
  if (!ctx) {
    throw new Error(
      "useExperienceProgress must be used within <ProgressProvider>",
    );
  }
  return ctx;
}

// Updates the shared progress each frame. Mounted first inside ProgressProvider
// so its useFrame runs before the consumers that read the value this frame.
function ProgressDriver({
  progress,
}: {
  progress: MutableRefObject<number>;
}) {
  const scroll = useScroll();

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05); // clamp big frame gaps (tab refocus)
    const target = clamp01(scroll.offset);
    const { smooth, maxSpeed } = EXPERIENCE.scroll;

    // Per-scene resistance scales ONLY the speed cap (base `smooth` is untouched).
    // Selected by where we currently are and eased across scene boundaries, so
    // content scenes feel heavier and transitions lighter without any snap.
    const resistance = resolveResistance(progress.current);

    let next = THREE.MathUtils.damp(progress.current, target, smooth, dt);
    const maxStep = maxSpeed * resistance * dt;
    next =
      progress.current +
      THREE.MathUtils.clamp(next - progress.current, -maxStep, maxStep);
    progress.current = clamp01(next);
  });

  return null;
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const progress = useRef(0);
  return (
    <ProgressContext.Provider value={progress}>
      <ProgressDriver progress={progress} />
      {children}
    </ProgressContext.Provider>
  );
}
