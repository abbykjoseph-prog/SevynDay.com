# Cinematic Scroll Experience — Build Notes

A single continuous WebGL experience where **scroll position drives one persistent
3D particle system** through eight morphing "scenes", with HTML content (headlines,
CTAs, stat cards) layered on top. It is the **homepage at `/`** on branch
**`feature/cinematic-scroll`**. The previous marketing homepage is preserved
verbatim at **`/classic`**, and **`/experience`** is kept as a redirect to `/` so
older shared links still work. (Earlier commits built this at `/experience`; it
was promoted to `/` — see "Routing".)

Original implementation — inspired by the "New Era" (Textura) reference for _vibe_
(palette, particle density, motion, the white-flash climax), not its code.

---

## How to run

```bash
npm install         # once, to pull the R3F stack (see Deps)
npm run dev         # http://localhost:3000/
npm run build       # production build — kept green at every commit
```

## Routing

- **`/`** — the animated experience / homepage (desktop & mobile). Site
  Header/Footer chrome are hidden here (the experience owns the viewport).
- **`/classic`** — the previous marketing homepage, preserved verbatim (moved
  from the old root `app/page.tsx`). Keeps its hero-reveal header.
- **`/experience`** — a redirect to `/` (legacy alias so shared links don't break).
- **`/?reduced=1`** — force the reduced-motion static fallback.
- **`/#debug`** — show the scroll-progress HUD and enable the
  `window.__exp.goto(offset)` frame-stepping helper (QA only; see below).

Chrome visibility is route-driven in `Header.tsx` / `Footer.tsx` (`isExperience`
= `/` or `/experience`; `isClassicHome` = `/classic`).

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
- **`EXPERIENCE.snap`** — the snap-to-section scroll model: `baseMs` / `minMs` /
  `maxMs` / `refSpan` (per-transition duration = `baseMs * span / refSpan`, clamped —
  so the long climax takes the max), `lockMs` (input cooldown after landing), and the
  `wheelThreshold` / `swipeThreshold` input filters.
- **`EXPERIENCE.outro`** — finale timings (`wordmarkMs`, `panelMs`), background fade
  (`bgFadeVh`), and the parked-logo `parkScale` / `parkX` / `parkY` (top-left position).
- **`EXPERIENCE`** — `pages`, `damping` (legacy, unused by the snap model),
  `background`, `dpr`, `particles`, `palette`, `flash`, `intro`.
- **`PROGRESS_STAGES` / `PROGRESS_DOTS`** — the right-edge scroll-progress indicator:
  the six CONTENT stages (name + anchor `at` p) and the dot styling (colors, size,
  gap, active scale, glow). The active dot is driven per frame in `handleFrame`
  (`stage-*` keys) and eases between dots across transitions; it's an additive
  overlay only (`ProgressDots.tsx`) that fades out on the finale handoff.

Other tunables:

- **Camera path** — `CameraRig.tsx` `CAM` (position + look target per scene).
- **Per-scene spin** — `ParticleField.tsx` `SPIN`.
- **Shape geometry** — `shapes.ts` (one writer function per scene).
- **Bloom / vignette / flash boost** — `Effects.tsx`.
- **Sun / hero core** — `SceneExtras.tsx`.

The stat numbers in the helix scene are placeholders, tagged **`TODO_UNVERIFIED_STAT`**
in `config/experience.ts` — replace once real figures are sourced.

The finale panel CTAs ("Explore the platform" / "See integrations") are
**`TODO_PLACEHOLDER`** in `config/experience.ts` (orbital `buttons`) — copy +
destinations are placeholder; they link to the on-page stub sections (`#features`,
`#how-it-works`) for now.

---

## Scroll model, finale & state persistence

**Snap-to-section (not free scrubbing).** The master `progress` (0..1, still read by
every scene unchanged) is no longer a follow of `scroll.offset` — ScrollControls is
gone. It is now tweened between the six stage targets (`PROGRESS_STAGES[i].at`) by
`SnapDriver` (in `Experience.tsx`), eased with `easeInOutCubic`. A `snap` ref holds
`{ value, stage, from, to, t, dur, animating, lastArrive }`; `SnapDriver` advances the
tween each frame and mirrors `snap.value → progress.current`.

- **One gesture = one stage.** Window `wheel` / `keydown` / `touch` listeners (active
  only in `scrub`) call `step(±1)`. Input is **locked** while `snap.animating` and for
  `lockMs` after landing — so a trackpad flick (many events) or a mouse notch both
  advance exactly one stage. Wheel/touch defaults are `preventDefault`'d so the page
  never scrolls under the pinned experience. Up/back settles on the previous stage.
- **Atomic climax.** Wave Terrain → Orbital is simply stage 4 → 5, but that span covers
  the gravity well + white flash, so the single tween plays the whole run and lands
  stably on Orbital(SEVYNDAY). Because input is locked for the whole tween, the user
  can never stop inside the well/flash. Same for clicking the Orbital dot.
- **Clickable dots** call `goToStage` (same tween). Clicking a dot after handoff
  re-enters the experience (`reenter`). Tune feel via `EXPERIENCE.snap`.

**Finale / handoff (`phase`: scrub → outro → released).** A forward gesture at Orbital
starts the outro (atomic — listeners unmount, so no input during it). SEVYNDAY shrinks
+ moves from center to a **parked top-left** logo (transform driven by
`outro.parkScale/parkX/parkY`) and stays there as a persistent site logo; the platform
panel rises from the bottom (`SiteSections.tsx`). After `max(wordmarkMs, panelMs)` the
phase releases: body scroll unlocks, the document scrolls normally through the panel +
stub sections, the WebGL background fades over `bgFadeVh` viewport-heights and its
render pauses (`frameloop="never"`) once off-screen. **Gradient softening:** the panel
background is a vertical dissolve (transparent top → `#04060c` bottom) so the orbit
feathers into the content with no hard edge.

**State persistence (home / back land at the END).** On mount `Experience` reads the
Navigation Timing type (`performance.getEntriesByType('navigation')[0].type`):
`back_forward` → initialize **directly** in the resolved end-state (`phase: released`,
snap on Orbital, hero gather disabled) so there is no replay/flash; `reload` / fresh
`navigate` → play from Hero. bfcache restores also land at the end-state (the finale is
the only place a user can navigate away from). The parked SEVYNDAY logo is a button
whose click runs `goHome()` — snap to Orbital + release + scroll to top, instantly, no
replay.

**Reduced-motion / mobile.** Reduced-motion still renders `ReducedExperience` (a normal
document-scroll static page) — now with SEVYNDAY parked top-left + the stub sections, so
it matches the resolved end-state without animation. Mobile uses swipe gestures for the
same one-swipe-per-stage behavior; the dots shrink/reposition.

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
