// Resolves the master scroll offset into a morph segment: which two adjacent
// scene shapes are active and how far between them (eased). Shared by the
// particle field, the camera rig, and per-scene spin so they stay in lockstep.
//
// Model: each scene owns a "hold" zone where its shape is pure; morphs happen
// only in the gaps between consecutive holds. This makes anchor scenes dwell on
// their shape while their content is on screen, instead of continuously drifting.

import { SCENES, HOLD_ZONES } from "@/config/experience";
import { smoothstep } from "./math";

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
