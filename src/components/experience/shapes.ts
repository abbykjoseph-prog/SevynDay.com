// Target-shape generators for the single morphing particle system.
//
// Every scene is one "shape": a Float32Array of XYZ positions plus a matching
// Float32Array of baked RGB colors (the scene's colorA→colorB gradient sampled
// per point). The particle field lerps point i from one shape to the next as
// scroll advances — correspondence is purely by index, so the same buffer
// morphs through all eight scenes.
//
// A shared per-point random table (`rnd`, 4 floats/point) keeps every shape
// deterministic and keeps per-point size/twinkle stable across the morph.

import * as THREE from "three";
import type { SceneDef } from "@/config/experience";

const TWO_PI = Math.PI * 2;

export interface ShapeBuffers {
  positions: Float32Array;
  colors: Float32Array;
}

export interface ParticleBuffers {
  shapes: ShapeBuffers[]; // one per scene, in SCENES order
  size: Float32Array; // per-point size multiplier
  seed: Float32Array; // per-point 0..1 seed for twinkle/motion
  count: number;
}

/** Deterministic PRNG so builds are stable frame-to-frame and SSR-safe. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Reusable scratch colors to avoid per-point allocation.
const cA = new THREE.Color();
const cB = new THREE.Color();
const cOut = new THREE.Color();

function bakeColor(colors: Float32Array, i: number, t: number) {
  cOut.copy(cA).lerp(cB, Math.min(1, Math.max(0, t)));
  colors[i * 3] = cOut.r;
  colors[i * 3 + 1] = cOut.g;
  colors[i * 3 + 2] = cOut.b;
}

// --- individual shape writers ------------------------------------------------
// Each writes point i's position into `p` and its gradient t (0=A, 1=B).

type Writer = (
  i: number,
  n: number,
  r0: number,
  r1: number,
  r2: number,
  r3: number,
  p: Float32Array,
) => number; // returns gradient t

// 1. HERO SPHERE — fibonacci shell, warm top → blue bottom, thin filament jitter.
const sphere: Writer = (i, n, r0, r1, _r2, _r3, p) => {
  const t = i / n;
  const phi = Math.acos(1 - 2 * t);
  const theta = TWO_PI * 1.618033988749895 * i;
  const R = 1.75 + (r0 - 0.5) * 0.06;
  const s = Math.sin(phi);
  const x = R * s * Math.cos(theta);
  const y = R * Math.cos(phi);
  const z = R * s * Math.sin(theta);
  p[0] = x;
  p[1] = y;
  p[2] = z;
  return 1 - (y / R) * 0.5 - 0.5; // top → A(warm)
};

// 2. FUNNEL DISSOLVE — wide swirl up top narrowing into a downward vortex.
const funnel: Writer = (_i, _n, r0, r1, r2, _r3, p) => {
  const u = r0;
  const rad = (2.3 - 2.2 * u) * (0.7 + 0.3 * r1);
  const ang = u * TWO_PI * 7 + r2 * TWO_PI;
  p[0] = rad * Math.cos(ang);
  p[1] = 1.9 - u * 4.6;
  p[2] = rad * Math.sin(ang);
  return u;
};

// 3. DNA HELIX — two intertwined strands + occasional rungs.
const helix: Writer = (i, _n, r0, r1, r2, r3, p) => {
  const strand = i % 2;
  const u = r0;
  const y = -2.4 + u * 4.8;
  const ang = u * TWO_PI * 3.2 + strand * Math.PI;
  const R = 0.85;
  if (r2 < 0.07) {
    // rung: interpolate across the two strands at this height
    const w = r3;
    const xA = R * Math.cos(ang);
    const zA = R * Math.sin(ang);
    const xB = R * Math.cos(ang + Math.PI);
    const zB = R * Math.sin(ang + Math.PI);
    p[0] = xA + (xB - xA) * w;
    p[1] = y;
    p[2] = zA + (zB - zA) * w;
  } else {
    const rr = R + (r1 - 0.5) * 0.05;
    p[0] = rr * Math.cos(ang);
    p[1] = y;
    p[2] = rr * Math.sin(ang);
  }
  return u;
};

// 4. STARFIELD — deep scattered volume with a faint galaxy band low in frame.
const starfield: Writer = (_i, _n, r0, r1, r2, r3, p) => {
  if (r3 < 0.4) {
    // galaxy band: thin, low, slightly wider spread
    p[0] = (r0 * 2 - 1) * 6.5;
    p[1] = -1.5 + (r1 - 0.5) * 0.7;
    p[2] = (r2 * 2 - 1) * 6 - 1;
  } else {
    p[0] = (r0 * 2 - 1) * 5.5;
    p[1] = (r1 * 2 - 1) * 3.4;
    p[2] = (r2 * 2 - 1) * 6 - 1;
  }
  return r3;
};

// 5. WAVE TERRAIN — undulating grid, blue (left) flowing to red/orange (right).
const FULL = 9;
const terrain: Writer = (i, n, _r0, r1, r2, _r3, p) => {
  const grid = Math.floor(Math.sqrt(n));
  const gx = i % grid;
  const gz = Math.floor(i / grid) % grid;
  const nx = gx / (grid - 1);
  const nz = gz / (grid - 1);
  const x = (nx - 0.5) * FULL + (r1 - 0.5) * 0.04;
  const z = (nz - 0.5) * FULL + (r2 - 0.5) * 0.04;
  const y =
    Math.sin(x * 0.9) * Math.cos(z * 0.9) * 0.5 +
    Math.sin(x * 0.4 + z * 0.35) * 0.32 -
    0.4;
  p[0] = x;
  p[1] = y;
  p[2] = z;
  return nx; // left → A(blue), right → B(red)
};

// 6. GRAVITY WELL — thin accretion disk spiralling around a dark central void.
const well: Writer = (_i, _n, r0, r1, r2, _r3, p) => {
  const rr = 0.4 + Math.pow(r0, 0.5) * 2.9; // no points inside the void
  const ang = r1 * TWO_PI + rr * 1.6; // spiral arms
  const flare = (r2 - 0.5) * 0.12 * rr;
  p[0] = rr * Math.cos(ang);
  p[1] = flare;
  p[2] = rr * Math.sin(ang);
  return (rr - 0.4) / 2.9; // inner blue → outer red
};

// 7. WHITE FLASH — everything imploded into a tight glowing core.
const flash: Writer = (_i, _n, r0, r1, r2, r3, p) => {
  const rr = 0.12 + r0 * 0.22;
  const phi = Math.acos(1 - 2 * r1);
  const theta = r2 * TWO_PI;
  const s = Math.sin(phi);
  p[0] = rr * s * Math.cos(theta);
  p[1] = rr * Math.cos(phi);
  p[2] = rr * s * Math.sin(theta);
  return r3;
};

// 8. ORBITAL ECOSYSTEM — tilted elliptical rings around a bright core.
const RINGS = 6;
const orbital: Writer = (i, _n, r0, r1, r2, _r3, p) => {
  const k = i % RINGS;
  const a = r0 * TWO_PI;
  const rx = 1.5 + k * 0.6;
  const rz = rx * (0.72 + 0.04 * k);
  const inc = (k % 2 === 0 ? 1 : -1) * (0.18 + k * 0.12);
  const thick = (r1 - 0.5) * 0.08;
  const lx = rx * Math.cos(a);
  const lz = rz * Math.sin(a);
  // tilt the ring around the X axis by `inc`
  const y = lz * Math.sin(inc) + thick;
  const z = lz * Math.cos(inc);
  p[0] = lx + (r2 - 0.5) * 0.05;
  p[1] = y;
  p[2] = z;
  return k % 2; // alternate blue / red rings
};

const WRITERS: Record<string, Writer> = {
  sphere,
  funnel,
  helix,
  starfield,
  terrain,
  well,
  flash,
  orbital,
};

/**
 * Build every scene's position+color buffer plus the shared size/seed tables.
 * Runs once on the client (uses no window APIs, so it is also SSR-safe).
 */
export function buildParticleBuffers(
  count: number,
  scenes: SceneDef[],
): ParticleBuffers {
  const rand = mulberry32(0x53455659); // "SEVY"
  const rnd = new Float32Array(count * 4);
  for (let i = 0; i < rnd.length; i++) rnd[i] = rand();

  const size = new Float32Array(count);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    size[i] = 0.55 + rnd[i * 4] * 0.9;
    seed[i] = rnd[i * 4 + 1];
  }

  const scratch = new Float32Array(3);
  const shapes: ShapeBuffers[] = scenes.map((scene) => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const writer = WRITERS[scene.id];
    cA.set(scene.colorA);
    cB.set(scene.colorB);
    for (let i = 0; i < count; i++) {
      const t = writer(
        i,
        count,
        rnd[i * 4],
        rnd[i * 4 + 1],
        rnd[i * 4 + 2],
        rnd[i * 4 + 3],
        scratch,
      );
      positions[i * 3] = scratch[0];
      positions[i * 3 + 1] = scratch[1];
      positions[i * 3 + 2] = scratch[2];
      bakeColor(colors, i, t);
    }
    return { positions, colors };
  });

  return { shapes, size, seed, count };
}
