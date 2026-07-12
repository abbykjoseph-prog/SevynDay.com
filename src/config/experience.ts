// Central tuning surface for the /experience cinematic scroll build.
//
// EVERYTHING downstream reads from here — particle shapes, camera path, content
// overlays, and postprocessing. To retune the experience (scroll ranges, colors,
// copy, particle counts, the white-flash timing) edit this file only.
//
// Scroll model: drei <ScrollControls pages={PAGES}> exposes a single master
// offset `p` in 0..1. Each scene "owns" a `range` of that offset for its content
// overlay, and morphs its particle shape toward the next scene across the gap
// between keyframe anchors (`at`).

export type SceneId =
  | "sphere"
  | "funnel"
  | "helix"
  | "starfield"
  | "terrain"
  | "well"
  | "flash"
  | "orbital";

export interface OverlayButton {
  label: string;
  href: string;
  variant: "primary" | "ghost";
}

export interface OverlayStat {
  value: string;
  label: string;
  /** true => placeholder marketing number, see TODO_UNVERIFIED_STAT */
  unverified?: boolean;
}

export interface SceneCopy {
  eyebrow?: string;
  heading?: string;
  sub?: string;
  buttons?: OverlayButton[];
  stats?: OverlayStat[];
  /** horizontal alignment of the overlay block */
  align?: "left" | "center";
}

export interface SceneDef {
  id: SceneId;
  label: string;
  /** scroll offset range this scene owns (0..1) — drives overlay fades */
  range: [number, number];
  /** morph keyframe anchor on the 0..1 offset (particles rest at this shape here) */
  at: number;
  /** particle gradient endpoint A (hex) — usually "top"/"left" of the shape */
  colorA: string;
  colorB: string;
  copy?: SceneCopy;
}

export const EXPERIENCE = {
  /** number of viewport-heights of scroll; also drei ScrollControls `pages` */
  pages: 8,
  /** drei ScrollControls smoothing. Kept low so `scroll.offset` tracks the raw
   *  scroll closely — the cinematic smoothing/rate-limiting is done on top of it
   *  by the shared progress driver (see `scroll` below + progressDrive.tsx). */
  damping: 0.1,
  /** The single progress value that drives every scene animation is a smoothed,
   *  speed-capped follow of `scroll.offset`:
   *   - smooth:   damp rate toward the target (higher = snappier, lower = floatier)
   *   - maxSpeed: hard ceiling on progress units/sec, so a scrollbar slam or fast
   *     flick animates as a smooth catch-up instead of a jump. */
  scroll: { smooth: 4, maxSpeed: 0.18 },
  /** One-time load-in for the hero: particles gather from scattered → formed and
   *  the hero text fades + rises `risePx`, over `seconds` with ease-out. Plays
   *  once on load (time-based from mount), never re-triggered by scroll. */
  intro: { seconds: 1.2, risePx: 16 },
  /** Finale / outro: at the orbital scene "SEVYNDAY" shows; the user's next
   *  scroll-down TRIGGERS a self-playing outro (ignores further scrubbing), then
   *  the pinned WebGL experience hands off to normal document scrolling.
   *   - triggerThreshold: progress p at/after which a scroll-down fires the outro
   *     (guards against firing before the orbital scene is actually reached)
   *   - wordmarkMs: "SEVYNDAY" exit-up duration
   *   - panelMs: platform panel rise duration
   *   - bgFadeVh: viewport-heights of post-release scroll over which the WebGL
   *     background fades to the site's dark bg (then the render is paused) */
  outro: {
    triggerThreshold: 0.965,
    wordmarkMs: 850,
    panelMs: 1000,
    bgFadeVh: 0.85,
    // On the outro, "SEVYNDAY" shrinks + moves from center to a parked top-left
    // site logo: `parkScale` and the parked CENTER position in px (parkX/parkY).
    parkScale: 0.26,
    parkX: 108,
    parkY: 40,
  },
  /** Snap-to-section scroll: one gesture advances through ONE transition and
   *  settles on the next stage (never mid-morph). The transition still eases
   *  smoothly — it just auto-completes. Per-transition duration is derived from
   *  the progress span it covers: `baseMs * span / refSpan`, clamped to
   *  [minMs, maxMs] — so the long Wave Terrain → Orbital climax run naturally
   *  takes the max. `lockMs` is the input cooldown after landing (absorbs
   *  trackpad momentum so one flick = one stage). Thresholds normalize wheel vs
   *  swipe input. Snap targets are the stage anchors in PROGRESS_STAGES. */
  snap: {
    /** default per-stage transition duration — long enough that the morph
     *  between shapes is a clearly watchable animation, not a blink. Used by any
     *  transition without an explicit override below. */
    transitionMs: 2000,
    /** Per-transition duration OVERRIDES in ms, indexed by the gap between
     *  adjacent stages:
     *    [0] Hero ↔ Funnel
     *    [1] Funnel ↔ Helix
     *    [2] Helix ↔ Starfield
     *    [3] Starfield ↔ Wave Terrain
     *    [4] Wave Terrain ↔ Orbital
     *  `null` → use the span-scaled default (`transitionMs`). Applies to a single
     *  adjacent-stage step in EITHER direction; the forward climax (gap 4 going
     *  up) uses `climax` instead. Nudge these two freely to retune the pacing. */
    overrideMs: [null, null, 3000, 3600, null] as (number | null)[],
    /** clamp for span-scaled durations (reverse climax / multi-stage dot jumps):
     *  duration = transitionMs * |span| / refSpan, clamped to [minMs, maxMs]. */
    minMs: 1200,
    maxMs: 3400,
    refSpan: 0.135,
    /** input cooldown after landing (with the transition lock: one flick = one
     *  stage). */
    lockMs: 320,
    wheelThreshold: 6,
    swipeThreshold: 44,
    /** Choreographed Wave Terrain → Orbital CLIMAX (the showpiece). A deliberate
     *  SLOW → FAST → SLOW speed curve. Each beat is a checkpoint: reach progress `p`
     *  by cumulative time `ms`, ARRIVING at that keyframe with velocity `v` (progress
     *  units per second — this is what sets the pacing). At runtime the beats are
     *  strung onto ONE continuous cubic-Hermite curve (see Experience.tsx): the `v`
     *  values are the shared tangents, so velocity is C1-continuous across every beat
     *  (no dwell/freeze/hard-cut) while the SPEED varies dramatically. The start
     *  keyframe has v=0 (gentle ease-in) and the last has v=0 (heavy ease-OUT settle).
     *  ~6.9s total, self-playing, not scrubbable:
     *   (1) SLOW  — terrain pulled in, gravity well forms & slowly shrinks (~3.0s)
     *   (2) FAST  — white flash blooms & releases + energetic burst out (~0.55s, peak v)
     *   (2b) DECEL — sharp, smooth velocity ramp-down out of the burst (~0.65s)
     *   (3) SLOW  — orbital ecosystem opens gently & cinematically, settles (~2.7s)
     *  The flash range/peak live in EXPERIENCE.flash ([0.78,0.845] peak 0.808); beat 2
     *  spans that window at high speed so the peak is crossed, never parked on. Tune
     *  each beat's `p` (target), `ms` (duration) and `v` (arrival speed) here — bigger
     *  `v` = faster there, smaller = slower/eased. Velocities are auto-clamped to a
     *  monotone-safe range so a mis-tuned value can never make the curve overshoot.
     *  (The last `p` snaps to the exact Orbital target.) */
    climax: [
      { p: 0.76, ms: 3000, v: 0.1 },
      { p: 0.85, ms: 550, v: 0.155 },
      { p: 0.895, ms: 650, v: 0.035 },
      { p: 0.95, ms: 2700, v: 0 },
    ],
  },
  background: "#04060c",
  /** device-pixel-ratio clamp for the Canvas */
  dpr: [1, 1.75] as [number, number],
  /** particle counts by form factor (mobile is also allowed to skip heavy work) */
  particles: { desktop: 50000, mobile: 12000 },
  palette: {
    blue: "#2ea8ff",
    cyan: "#8fd6ff",
    ice: "#dce8ff",
    violet: "#7b6bff",
    red: "#ff5a3c",
    amber: "#ffb15a",
    white: "#ffffff",
  },
  /** scene 7 white-flash: additive plane + bloom overshoot ramps over this range */
  flash: { range: [0.78, 0.845] as [number, number], peak: 0.808 },
} as const;

// The eight keyframe shapes, in scroll order. `at` values are the morph anchors
// the particle field rests on; `range` values are the (possibly overlapping)
// windows their DOM overlays fade through.
export const SCENES: SceneDef[] = [
  {
    id: "sphere",
    label: "Hero sphere",
    range: [0.0, 0.11],
    at: 0.0,
    colorA: "#ff5a3c", // warm at the top
    colorB: "#2ea8ff", // electric blue toward the bottom
    copy: {
      align: "left",
      eyebrow: "Welcome to SevynDay",
      heading: "Absence management, reimagined for the modern workplace",
      sub: "AI-assisted disability and leave case management, built for Canadian enterprises — accurate, compliant, and genuinely human.",
    },
  },
  {
    id: "funnel",
    label: "Funnel dissolve",
    range: [0.12, 0.23],
    at: 0.12,
    colorA: "#2ea8ff",
    colorB: "#8fd6ff",
  },
  {
    id: "helix",
    label: "DNA helix",
    range: [0.25, 0.37],
    at: 0.24,
    colorA: "#2ea8ff",
    colorB: "#7b6bff",
    copy: {
      align: "left",
      eyebrow: "Built on better data",
      stats: [
        // TODO_UNVERIFIED_STAT — placeholder marketing figure, replace once sourced.
        { value: "3×", label: "faster case resolution", unverified: true },
        // TODO_UNVERIFIED_STAT — placeholder marketing figure, replace once sourced.
        { value: "70%", label: "lower admin load", unverified: true },
      ],
    },
  },
  {
    id: "starfield",
    label: "Starfield flythrough",
    range: [0.38, 0.5],
    at: 0.38,
    colorA: "#dce8ff",
    colorB: "#2ea8ff",
  },
  {
    id: "terrain",
    label: "Wave terrain",
    range: [0.51, 0.65],
    at: 0.5,
    colorA: "#2ea8ff", // blue on the left
    colorB: "#ff5a3c", // flowing to red/orange on the right
    copy: {
      align: "left",
      eyebrow: "The pull of results",
      heading: "Everything revolves around one thing — your people",
      sub: "Thousands of data points, one source of truth. SevynDay turns the noise of leave, disability, and accommodation into clear, defensible decisions.",
    },
  },
  {
    id: "well",
    label: "Gravity well",
    range: [0.66, 0.77],
    at: 0.66,
    colorA: "#2ea8ff",
    colorB: "#ff5a3c",
  },
  {
    id: "flash",
    label: "White flash",
    range: [0.78, 0.83],
    at: 0.78,
    colorA: "#ffffff",
    colorB: "#dce8ff",
  },
  {
    id: "orbital",
    label: "Orbital ecosystem",
    range: [0.85, 1.0],
    at: 0.85,
    colorA: "#2ea8ff",
    colorB: "#ff5a3c",
    copy: {
      align: "center",
      eyebrow: "One connected ecosystem",
      heading: "A platform your whole workplace revolves around",
      sub: "Not a single tool, but a living system — connecting HR, employees, providers, and compliance around every case.",
      // TODO_PLACEHOLDER — finale panel CTAs: copy + destinations are placeholder;
      // linked to the on-page stub sections for now. Finalize label + href later.
      buttons: [
        { label: "Explore the platform", href: "#features", variant: "primary" },
        { label: "See integrations", href: "#how-it-works", variant: "ghost" },
      ],
    },
  },
];

// Per-scene "hold" zones on the 0..1 offset: the particle shape stays pure
// within its hold, and morphs happen only in the GAPS between consecutive holds.
// Anchor scenes (sphere/helix/terrain/orbital) hold long enough for their
// content to read; transition scenes (funnel/starfield/well/flash) hold briefly.
// Keep these ordered and non-overlapping. Content `range`s above should sit
// inside the matching hold so copy shows while the shape is settled.
export const HOLD_ZONES: Record<SceneId, [number, number]> = {
  sphere: [0.0, 0.02], // hero starts dispersing almost immediately on scroll
  funnel: [0.155, 0.175],
  helix: [0.27, 0.33],
  starfield: [0.42, 0.45],
  terrain: [0.545, 0.61],
  well: [0.7, 0.72],
  flash: [0.805, 0.815],
  orbital: [0.905, 1.0],
};

// Per-scene scroll "resistance": multiplies EXPERIENCE.scroll.maxSpeed while a
// scene is active, so content scenes feel slightly heavier (readers get time to
// land on the copy) and transition scenes feel slightly lighter. The progress
// driver EASES between these across scene boundaries (via the same segment blend
// as the shapes/camera), so the change in feel is smooth — it never snaps.
//   < 1 = heavier / slower   ·   1 = neutral   ·   > 1 = lighter / faster
// Keep the spread subtle; tune all values here.
export const SCROLL_RESISTANCE: Record<SceneId, number> = {
  sphere: 0.7, // content — dwell on the hero copy
  funnel: 1.15, // transition
  helix: 0.7, // content — dwell on the stat cards
  starfield: 1.15, // transition
  terrain: 0.7, // content
  well: 1.15, // transition
  flash: 1.15, // transition
  orbital: 0.7, // content — dwell on the finale copy
};

// Bespoke overlays for two transition scenes (custom layouts, not the standard
// CopyBlock). Text lives here; layout/timing/drift live in Overlay.tsx +
// Experience's frame loop.
//
// Funnel: three flat overlay labels, stacked and centered in the sparse upper
// funnel. They fade in TOGETHER (~p=0.16) and fade out together at the exit.
export const FUNNEL_LABELS = [
  "Instant Adjudication",
  "Forensic Papertrail",
  "Effortless Caseload",
];

// The centered stack fades in together (~0.16), glides as one unit from `startX`
// px (off-center left) to `startX + glide` px (right) across the scene, and
// renders at `fontSizePx` (capped responsively so it fits small screens). Keep
// `startX + glide` small enough that the longest line stays on screen at the end
// of the glide. Tune all three here.
export const FUNNEL_STYLE = { startX: -80, glide: 180, fontSizePx: 42 };
// Starfield: one large, glowing, centered statement that fades in/out with the
// scene.
export const STARFIELD_STATEMENT =
  "Every absence, accounted for. Every decision, defensible.";

// Scroll-progress indicator: ONE dot per CONTENT stage (six). Transition scenes
// (funnel-dissolve gaps, gravity well) and the white flash are NOT their own
// dots — they belong to the transition between stages, so the active highlight
// eases from one dot to the next across them. `at` is the progress p that
// represents each stage; the active dot is the one `p` is nearest.
export const PROGRESS_STAGES: { id: string; name: string; at: number }[] = [
  { id: "sphere", name: "Hero", at: 0.03 },
  { id: "funnel", name: "Funnel", at: 0.165 },
  { id: "helix", name: "Helix", at: 0.3 },
  { id: "starfield", name: "Starfield", at: 0.435 },
  { id: "terrain", name: "Wave Terrain", at: 0.58 },
  // Orbital settles at 0.95 (also the snap target) so SEVYNDAY is fully shown.
  { id: "orbital", name: "Orbital", at: 0.95 },
];

// Dot styling for the progress indicator. Minimal/premium: dim white inactive,
// electric-blue active with a soft glow. Tune sizes/spacing/scale/colors here.
export const PROGRESS_DOTS = {
  activeColor: "#2ea8ff",
  inactiveColor: "rgba(210,220,235,0.32)",
  glow: "0 0 9px 2px rgba(46,168,255,0.7)", // active-dot glow (electric blue)
  sizePx: 7, // dot diameter (desktop; mobile shrinks)
  gapPx: 18, // vertical spacing between dots (desktop; mobile shrinks)
  activeScale: 1.5, // active dot is this much larger
};

// Convenience lookups.
export const SCENE_BY_ID = Object.fromEntries(
  SCENES.map((s) => [s.id, s]),
) as Record<SceneId, SceneDef>;

/** Morph anchors in scroll order — the particle field interpolates between these. */
export const MORPH_ANCHORS = SCENES.map((s) => s.at);
