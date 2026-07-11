// Tiny math helpers shared across the experience. Kept dependency-free so both
// the R3F frame loop and plain DOM overlays can use them.

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Hermite smoothstep on 0..1. */
export const smoothstep = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** Ease-out cubic on 0..1 — fast start, gentle settle. */
export const easeOutCubic = (t: number) => {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
};

/** Remap x from [a,b] to [0,1], clamped. */
export const range01 = (x: number, a: number, b: number) =>
  clamp01((x - a) / (b - a || 1));

/**
 * Fade weight for a scene window: ramps 0→1 over `fade` at the start, holds at 1,
 * then ramps 1→0 over `fade` at the end. Used to fade content overlays in/out.
 */
export const windowFade = (
  p: number,
  start: number,
  end: number,
  fade = 0.03,
) => {
  const rise = range01(p, start, start + fade);
  const fall = 1 - range01(p, end - fade, end);
  return smoothstep(Math.min(rise, fall));
};

/** A soft 0→1→0 pulse peaking at `peak` inside [start,end]. */
export const pulse = (p: number, start: number, end: number, peak: number) => {
  if (p <= start || p >= end) return 0;
  const t = p < peak ? range01(p, start, peak) : 1 - range01(p, peak, end);
  return smoothstep(t);
};
