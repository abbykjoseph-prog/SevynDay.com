// Resolves the master scroll offset into a morph segment: which two adjacent
// scene shapes are active and how far between them (eased). Shared by the
// particle field, the camera rig, and per-scene spin so they stay in lockstep.

import { MORPH_ANCHORS } from "@/config/experience";
import { smoothstep } from "./math";

export interface Segment {
  from: number; // index of the shape we're leaving
  to: number; // index of the shape we're heading to
  mix: number; // eased 0..1 blend from → to
  raw: number; // un-eased 0..1 within the segment
}

const A = MORPH_ANCHORS;
const LAST = A.length - 1;

export function resolveSegment(p: number): Segment {
  if (p <= A[0]) return { from: 0, to: Math.min(1, LAST), mix: 0, raw: 0 };
  if (p >= A[LAST]) return { from: LAST, to: LAST, mix: 1, raw: 1 };
  let j = 0;
  while (j < LAST && p >= A[j + 1]) j++;
  const span = A[j + 1] - A[j] || 1;
  const raw = (p - A[j]) / span;
  return { from: j, to: j + 1, mix: smoothstep(raw), raw };
}
