// Resolves the master scroll offset into a morph segment: which two adjacent
// scene shapes are active and how far between them (eased). Shared by the
// particle field, the camera rig, and per-scene spin so they stay in lockstep.
//
// Model: each scene owns a "hold" zone where its shape is pure; morphs happen
// only in the gaps between consecutive holds. This makes anchor scenes dwell on
// their shape while their content is on screen, instead of continuously drifting.

import {
  SCENES,
  HOLD_ZONES,
  SCROLL_RESISTANCE,
  type SceneId,
} from "@/config/experience";
import { lerp, smoothstep } from "./math";

export interface Segment {
  from: number; // index of the shape we're leaving (or resting on)
  to: number; // index of the shape we're heading to
  mix: number; // eased 0..1 blend from → to
  raw: number; // un-eased 0..1 within the transition gap
}

const HOLDS = SCENES.map((s) => HOLD_ZONES[s.id]);
const N = HOLDS.length;

export function resolveSegment(p: number): Segment {
  for (let i = 0; i < N; i++) {
    const [hs, he] = HOLDS[i];
    if (p <= he) {
      // Resting inside hold i → pure shape i.
      if (p >= hs || i === 0) return { from: i, to: i, mix: 0, raw: 0 };
      // In the gap before hold i → morph shape i-1 → shape i.
      const prevEnd = HOLDS[i - 1][1];
      const raw = (p - prevEnd) / (hs - prevEnd || 1);
      return { from: i - 1, to: i, mix: smoothstep(raw), raw };
    }
  }
  // Past the last hold → rest on the final shape.
  return { from: N - 1, to: N - 1, mix: 1, raw: 1 };
}

// Per-scene group spin (rad/s), interpolated across the active segment. Shared
// by the particle field and the 3D funnel labels so they orbit in lockstep.
const SPIN: Record<SceneId, number> = {
  sphere: 0.14,
  funnel: 0.09, // slightly faster so the funnel labels orbit a touch livelier
  helix: 0.16,
  starfield: 0.0,
  terrain: 0.0,
  well: 0.06,
  flash: 0.04,
  orbital: 0.11,
};
const SPIN_BY_INDEX = SCENES.map((s) => SPIN[s.id]);

/** Blended group spin (rad/s) at progress `p`. */
export function resolveSpin(p: number): number {
  const seg = resolveSegment(p);
  return lerp(
    SPIN_BY_INDEX[seg.from],
    SPIN_BY_INDEX[seg.to] ?? SPIN_BY_INDEX[seg.from],
    seg.mix,
  );
}

const RESISTANCE = SCENES.map((s) => SCROLL_RESISTANCE[s.id]);

// The active scene's scroll-resistance multiplier at progress `p`, eased across
// scene boundaries using the same segment blend as the shapes/camera (so it
// tracks the visual transition and never snaps). 1 = neutral.
export function resolveResistance(p: number): number {
  const seg = resolveSegment(p);
  return lerp(RESISTANCE[seg.from], RESISTANCE[seg.to] ?? RESISTANCE[seg.from], seg.mix);
}
