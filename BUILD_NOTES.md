# Cinematic Scroll Experience — Build Notes

A single continuous WebGL experience where **scroll position drives one persistent
3D particle system** through eight morphing "scenes", with HTML content (headlines,
CTAs, stat cards) layered on top. Lives at **`/experience`** on branch
**`feature/cinematic-scroll`**. The existing homepage and components are untouched.

Original implementation — inspired by the "New Era" (Textura) reference for _vibe_
(palette, particle density, motion, the white-flash climax), not its code.

---

## How to run

```bash
npm install         # once, to pull the R3F stack (see Deps)
npm run dev         # http://localhost:3020/experience
npm run build       # production build — kept green at every commit
```

- **`/experience`** — the animated experience (desktop & mobile).
- **`/experience?reduced=1`** — force the reduced-motion static fallback.
- **`/experience#debug`** — show the scroll-progress HUD and enable the
  `window.__exp.goto(offset)` frame-stepping helper (QA only; see below).

> ⚠️ **Dev/build gotcha:** `next dev` and `next build` share the `.next` directory.
> Running `npm run build` **while the dev server is live** corrupts the dev server's
> webpack chunks (`Error: Cannot find module './###.js'`, every route 500s). Always
> **stop the dev server before `npm run build`**, then restart it. If it happens:
> stop dev → `rm -rf .next` → restart dev.

---

## Dependencies added

| package | version | why |
| --- | --- | --- |
| `@react-three/fiber` | ^8.18 | React renderer for three.js (React-18 major) |
| `@react-three/drei` | ^9.122 | `ScrollControls`, `useScroll` |
| `@react-three/postprocessing` | ^2.19 | `EffectComposer`, `Bloom`, `Vignette`, `ToneMapping` |

`three` stays at the repo's existing **^0.185.1** (the raw-three homepage sphere
depends on it) — the R3F stack majors above are the ones compatible with React 18
that also tolerate three 0.185. Also added the **Space Grotesk** display font via
`next/font/google`.

One pre-existing file was touched out of necessity: `Container.tsx`'s polymorphic
`as` prop was widened from `keyof JSX.IntrinsicElements` to `React.ElementType`,
because installing `@react-three/fiber` globally augments `JSX.IntrinsicElements`
with three elements (some with required props), which broke the old type. Behavior
is unchanged.

---

## Architecture

Everything is a **pure function of the scroll offset `p` (0..1)** exposed by a single
drei `<ScrollControls pages={8}>`.

```
app/experience/page.tsx            server component, metadata only
  └─ ExperienceClient.tsx          "use client"; env detection + ssr:false dynamic import
       ├─ ReducedExperience.tsx    prefers-reduced-motion / ?reduced fallback (no WebGL)
       └─ Experience.tsx           the <Canvas> + <ScrollControls> + DOM overlays
            ├─ ParticleField.tsx   the ONE morphing particle system (custom shader)
            ├─ SceneExtras.tsx     additive glow sprites (orbital sun, hero core)
            ├─ CameraRig.tsx       per-scene camera keyframes + pointer parallax
            ├─ Effects.tsx         Bloom + Vignette + ACES tonemap (+ flash overshoot)
            ├─ Overlay.tsx         HTML content layer for the 4 anchor scenes
            └─ FrameBridge         reads scroll each frame → drives overlay fades + flash
```

**The morphing particle system (the key idea).** One `BufferGeometry` of N points
(desktop 50k / mobile 12k). Each of the 8 scenes is a target **shape**: a positions
array + a baked per-point color gradient (`shapes.ts`). Two attribute pairs
(`aPositionFrom/To`, `aColorFrom/To`) hold the two currently-active shapes; a custom
additive `ShaderMaterial` lerps `mix(from, to, uMix)` per vertex. As scroll crosses a
keyframe boundary the from/to attributes are swapped to the next shape pair. The
shader also adds size-attenuation, a per-point twinkle, the terrain ripple
(`uWaveAmt`), and the starfield forward-stream (`uStarAmt`).

**Hold zones (pacing).** `resolveSegment(p)` (`progress.ts`) maps `p` to
`{from, to, mix}` using `HOLD_ZONES` from the config: each scene's shape stays **pure**
within its hold zone and morphs only in the **gaps** between holds. This makes anchor
scenes dwell on their shape while their content is on screen, instead of continuously
drifting. Camera and per-scene spin use the same `resolveSegment`, so they stay in
lockstep.

**Overlays.** `Overlay.tsx` renders the anchor-scene copy as a fixed DOM layer above
the canvas. `FrameBridge` (in `Experience`) cross-fades each block per frame from `p`
using the scene's content `range` (with edge-holds so the hero shows at `p=0` and the
orbital finale holds at `p=1`), and toggles `pointer-events` so CTAs are only clickable
when their scene is on screen.

**White flash (scene 7).** Two layers: `Effects` ramps Bloom intensity hard across the
flash range (glow overshoot), and `Experience` fades a fullscreen white plane
(`mix-blend: screen`) to full and back — a real palette-reset blowout.

---

## The 8 scenes

| # | id | content range | hold zone | shape / colors |
| --- | --- | --- | --- | --- |
| 1 | sphere | 0.00–0.11 | 0.00–0.09 | fibonacci shell, warm-red top → electric-blue bottom (+ hero core) |
| 2 | funnel | — | 0.15–0.18 | downward swirl/vortex, blue→cyan (transition) |
| 3 | helix | 0.25–0.37 | 0.255–0.345 | double helix + rungs, blue→violet |
| 4 | starfield | — | 0.40–0.46 | deep scatter + low galaxy band (transition) |
| 5 | terrain | 0.51–0.65 | 0.515–0.635 | undulating grid, blue (left) → red/orange (right) |
| 6 | well | — | 0.69–0.73 | accretion disk around a dark void, blue→red (transition) |
| 7 | flash | — | 0.80–0.82 | imploded core + fullscreen white blowout (transition) |
| 8 | orbital | 0.85–1.00 | 0.875–1.00 | tilted blue/red rings around a sun core |

Anchor scenes (1, 3, 5, 8) carry content; the rest are transitions.

---

## Where to tune

Almost everything lives in **`src/config/experience.ts`**:

- **`SCENES`** — per-scene copy (eyebrow / heading / sub / buttons / stats), content
  `range`, and gradient `colorA`/`colorB`. Edit copy and colors here.
- **`HOLD_ZONES`** — where each shape holds vs. morphs (pacing).
- **`EXPERIENCE`** — `pages`, `damping`, `background`, `dpr`, `particles` (desktop/mobile
  counts), `palette`, and `flash` (range + peak).

Other tunables:

- **Camera path** — `CameraRig.tsx` `CAM` (position + look target per scene).
- **Per-scene spin** — `ParticleField.tsx` `SPIN`.
- **Shape geometry** — `shapes.ts` (one writer function per scene).
- **Bloom / vignette / flash boost** — `Effects.tsx`.
- **Sun / hero core** — `SceneExtras.tsx`.

The stat numbers in the helix scene are placeholders, tagged **`TODO_UNVERIFIED_STAT`**
in `config/experience.ts` — replace once real figures are sourced.

---

## Accessibility & performance

- **prefers-reduced-motion** (or `?reduced=1`) → `ReducedExperience`: no WebGL, a static
  hero over a soft radial glow, then the content scenes as normal stacked sections (with
  the site header/footer). No scroll-jacking.
- **Mobile** (`max-width: 767px`) → 12k particles (vs 50k), slightly larger point size,
  lighter bloom radius. Overlays reflow (bottom-anchored, smaller type). Verified at
  ~400px wide.
- **dpr** capped at `[1, 1.75]`. Single draw call for all particles; additive blending,
  `depthTest:false`. SSR-safe: the Canvas is a `ssr:false` dynamic import and all
  `window`/`document` access is client-only or guarded.

---

## Decisions & assumptions

- **Layout / site chrome.** The WebGL layer is a `fixed inset-0 z-0` background and the
  released site content is normal document flow above it (`z-10`). Because the canvas is
  no longer a `z-50` cover, the global `Header`/`Footer` are hidden on `/experience`
  (each early-returns `null` when `usePathname() === "/experience"` — `Footer` became a
  client component for this). The page supplies its own footer (see the handoff section).
- **Reference recording.** `ffmpeg` wasn't available and `qlmanage` hung, so frames
  couldn't be extracted from the provided `.mov`. Built from the written spec (which is
  authoritative for copy/ranges/architecture/colors) plus knowledge of the reference's
  look. Scene visuals were verified by forced-frame screenshots.
- **Canvas sizing.** R3F's first measurement inside the fixed container returns the
  300×150 canvas default and the ResizeObserver never re-fires; fixed with an explicit
  `100vw/100vh` Canvas style + `resize={{offsetSize:true}}` + a few post-mount synthetic
  `resize` events.
- **QA helper.** `#debug` exposes `window.__exp.goto(p)` which sets drei's damped offset
  directly and force-renders one frame via R3F's `advance()` — needed because the
  headless preview tab pauses `requestAnimationFrame`. Gated behind `#debug`; absent in
  normal use.

## Finale / outro — pinned → normal-scroll handoff

The most delicate part: handing the pinned, scroll-scrubbed WebGL experience off into
a normally-scrolling site, without a visual jump. It's a 3-phase state machine in
`Experience.tsx` (`phase: "scrub" | "outro" | "released"`).

- **scrub** — as before. ScrollControls drives scenes 1–8. When progress reaches the
  orbital scene, the **"SEVYNDAY"** wordmark fades in (opacity driven per frame in
  `handleFrame`). Body scroll is **locked** (`html`/`body` `overflow:hidden`) so only
  ScrollControls scrubs.
- **outro** — triggered by the user's next scroll-down at the orbital finale. A window
  wheel/touch/key listener fires **only** while `phase==="scrub"` AND
  `progress ≥ outro.triggerThreshold` (guards against firing early / off-orbital), and
  the listeners are torn down the instant we leave scrub (guards double-fire). The outro
  is **self-playing** (ignores further scrubbing — ScrollControls is `enabled={false}`):
  "SEVYNDAY" translates up-and-off and the platform panel rises from the bottom. Both are
  CSS transitions **driven by `phase` in JSX** (not imperative), so React re-renders
  never reset them.
- **released** — after `max(wordmarkMs, panelMs)+80ms` the phase flips to `released`:
  body scroll is **unlocked**, the WebGL layer goes `pointer-events:none`, and the
  document scrolls normally.

**Why there's no jump:** the released content (platform panel + placeholder sections)
lives in normal document flow the *whole time*. During scrub it's just translated
`translateY(100vh)` (below the fold) with body scroll locked. The outro animates it to
`translateY(0)`; release only **removes the transform + unlocks scroll** — and its
layout position already *is* scroll-0, so nothing moves.

**Background fade + teardown:** after release, a scroll listener fades the WebGL
background out over `outro.bgFadeVh` viewport-heights, then pauses the render
(`Canvas frameloop` → `"never"`) once it's off-screen; scrolling back up resumes it.

**Where to tune:** `EXPERIENCE.outro` in `config/experience.ts`
(`triggerThreshold`, `wordmarkMs`, `panelMs`, `bgFadeVh`). The SEVYNDAY fade-in range
(`0.9→0.95`) and the outro easing curves are in `Experience.tsx`. The landing panel and
the **Features / How it works / Pricing / Footer** stubs are in `SiteSections.tsx`
(the panel reuses the orbital scene's copy; orbital is excluded from the scrubbed
overlays in `Overlay.tsx`). Reduced-motion and mobile: reduced users get the static page
(`ReducedExperience.tsx`, no outro, normal scroll); mobile uses the same machine with a
touch-swipe trigger.

**Verified (against the dev server):** scrub scenes unchanged; SEVYNDAY at orbital;
wheel/key trigger → outro (content `translateY(0)` + transition) → released (wordmark
unmounted, body scroll unlocked, bg `pointer-events:none`, document scrollable); all
placeholder sections render; reduced-motion static page scrolls normally; no console
errors. The scroll-driven bg fade and the live outro *animation* are best confirmed in a
foreground browser (the headless test tab pauses rAF/timers and defers programmatic
scroll).

## Known gaps / polish next

- **Funnel (scene 2)** reads more as a bright energy-disk than a literal downward funnel
  at some offsets; fine as a fast transition, could be shaped further.
- **`THREE.Clock` deprecation warning** in the console comes from R3F v8 on three 0.185
  (library, not app code). Benign — a warning, not an error.
- Camera path and bloom are tuned by eye; worth a fine pass on a high-refresh display.
- The debug HUD/`__exp` bridge could be stripped entirely for production if desired
  (currently just gated behind `#debug`).
- Real scroll-driven playback (momentum, 60fps) was validated mechanically; a final
  human scroll-through on a physical machine is recommended before shipping.
