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
      buttons: [
        { label: "Book a demo", href: "/demo", variant: "primary" },
        { label: "See how it works", href: "#how-it-works", variant: "ghost" },
      ],
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
        { value: "68%", label: "lower admin load", unverified: true },
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
      buttons: [
        { label: "Book a demo", href: "/demo", variant: "primary" },
        { label: "Talk to us", href: "/demo", variant: "ghost" },
      ],
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
      buttons: [
        { label: "Explore the platform", href: "/product", variant: "primary" },
        { label: "See integrations", href: "/product", variant: "ghost" },
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

// Convenience lookups.
export const SCENE_BY_ID = Object.fromEntries(
  SCENES.map((s) => [s.id, s]),
) as Record<SceneId, SceneDef>;

/** Morph anchors in scroll order — the particle field interpolates between these. */
export const MORPH_ANCHORS = SCENES.map((s) => s.at);
