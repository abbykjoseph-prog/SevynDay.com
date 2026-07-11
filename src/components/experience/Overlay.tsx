"use client";

import Link from "next/link";
import type { MutableRefObject } from "react";
import {
  FUNNEL_LABELS,
  FUNNEL_STYLE,
  SCENES,
  STARFIELD_STATEMENT,
  type SceneDef,
} from "@/config/experience";

// The HTML content layer for the anchor scenes (sphere, helix, terrain,
// orbital). Rendered as a fixed layer above the Canvas; each block's opacity /
// transform / pointer-events are driven per frame from the scroll offset by
// Experience (see handleFrame), so blocks cross-fade as their scene arrives.

// Orbital is excluded: at the finale it shows the SEVYNDAY wordmark instead, and
// its copy is re-presented as the released platform panel (see SiteSections).
export const CONTENT_SCENES: SceneDef[] = SCENES.filter(
  (s) => s.copy && s.id !== "orbital",
);

function Pill({
  children,
  large = false,
}: {
  children: React.ReactNode;
  large?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 font-medium uppercase text-white/75 backdrop-blur ${
        large
          ? "gap-2.5 px-5 py-2 text-[15px] tracking-[0.22em]"
          : "gap-2 px-3.5 py-1.5 text-[11px] tracking-[0.22em]"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#2ea8ff] shadow-[0_0_8px_2px_rgba(46,168,255,0.7)]" />
      {children}
    </span>
  );
}

function Buttons({
  buttons,
}: {
  buttons: NonNullable<SceneDef["copy"]>["buttons"];
}) {
  if (!buttons) return null;
  return (
    // Click-through by default; Experience re-enables pointer events on this
    // wrapper only while the scene is on screen, so the wheel reaches the
    // scroll controller everywhere except directly over a live button.
    <div
      data-cta
      className="mt-9 flex flex-wrap gap-3"
      style={{ pointerEvents: "none" }}
    >
      {buttons.map((b) =>
        b.variant === "primary" ? (
          <Link
            key={b.label}
            href={b.href}
            className="inline-flex items-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#04060c] shadow-[0_8px_30px_-8px_rgba(255,255,255,0.5)] transition hover:bg-white/90"
          >
            {b.label}
          </Link>
        ) : (
          <Link
            key={b.label}
            href={b.href}
            className="inline-flex items-center rounded-full border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white/90 backdrop-blur transition hover:border-white/40 hover:bg-white/10"
          >
            {b.label}
          </Link>
        ),
      )}
    </div>
  );
}

function Stats({ stats }: { stats: NonNullable<SceneDef["copy"]>["stats"] }) {
  if (!stats) return null;
  return (
    <div className="mt-10 flex flex-wrap gap-5">
      {stats.map((st) => (
        <div
          key={st.label}
          className="min-w-[190px] rounded-2xl border border-white/10 bg-white/[0.06] px-7 py-6 backdrop-blur-md"
        >
          <div className="font-display text-5xl font-semibold text-white">
            {st.value}
          </div>
          <div className="mt-1.5 text-sm text-white/60">{st.label}</div>
        </div>
      ))}
    </div>
  );
}

function CopyBlock({ scene }: { scene: SceneDef }) {
  const copy = scene.copy!;
  const isHero = scene.id === "sphere";
  return (
    <div className={copy.align === "center" ? "max-w-3xl text-center" : "max-w-2xl"}>
      {copy.eyebrow && <Pill large={isHero}>{copy.eyebrow}</Pill>}
      {copy.heading && (
        <h1
          className={`mt-6 font-display font-semibold tracking-tight text-white [text-wrap:balance] ${
            isHero
              ? "text-4xl leading-[1.05] sm:text-6xl lg:text-7xl"
              : "text-3xl leading-[1.08] sm:text-5xl"
          }`}
          style={{ textShadow: "0 2px 40px rgba(4,6,12,0.75)" }}
        >
          {copy.heading}
        </h1>
      )}
      {copy.sub && (
        <p
          className={`mt-6 text-base leading-relaxed text-white/75 sm:text-lg ${
            copy.align === "center" ? "mx-auto max-w-xl" : "max-w-xl"
          }`}
          style={{ textShadow: "0 1px 20px rgba(4,6,12,0.7)" }}
        >
          {copy.sub}
        </p>
      )}
      <Stats stats={copy.stats} />
      <div className={copy.align === "center" ? "flex justify-center" : ""}>
        <Buttons buttons={copy.buttons} />
      </div>
    </div>
  );
}

// Funnel scene: three flat overlay labels stacked as a centered vertical list in
// the thin, sparse UPPER portion of the funnel (never the dense lower part). The
// whole stack fades in/out and glides left → right as one unit, driven per frame
// in handleFrame (key `funnel-stack`). A feathered radial scrim + the blue-glow
// CSS class keep them legible even over the brightest particles.
function FunnelLabelsOverlay({
  blockRefs,
}: {
  blockRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
}) {
  // One stack: the whole group's fade + glide (translateX) + slight rise are
  // driven together in handleFrame (key `funnel-stack`). Lines are static; the
  // blue glow + subtle shimmer come from the `.funnel-label-glow` CSS class.
  return (
    <div
      ref={(el) => {
        blockRefs.current["funnel-stack"] = el;
      }}
      className="absolute left-1/2 top-[13%] flex flex-col items-center gap-6 text-center will-change-[opacity,transform] sm:gap-7"
      style={{ opacity: 0, transform: "translate(-50%, 0)" }}
    >
      {FUNNEL_LABELS.map((label) => (
        <div key={label} className="relative">
          {/* Soft feathered dark backing — no visible box, just a legibility halo. */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2"
            style={{
              width: "160%",
              height: "320%",
              background:
                "radial-gradient(ellipse at center, rgba(4,6,12,0.5) 0%, rgba(4,6,12,0.26) 44%, rgba(4,6,12,0) 72%)",
            }}
          />
          <span
            className="funnel-label-glow font-display font-semibold leading-none tracking-tight"
            style={{
              color: "#f4f7fb",
              fontSize: `min(${FUNNEL_STYLE.fontSizePx}px, 7vw)`,
            }}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

// Starfield scene: one large, blocky, glowing statement, centered. Opacity (and
// a subtle scale) driven per frame in handleFrame (key `starfield`).
function StarfieldStatement({
  blockRefs,
}: {
  blockRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
}) {
  return (
    <div
      ref={(el) => {
        blockRefs.current["starfield"] = el;
      }}
      className="absolute inset-0 flex items-center justify-center px-6 will-change-[opacity,transform]"
      style={{ opacity: 0 }}
    >
      <h2
        className="max-w-5xl text-center font-display text-4xl font-bold leading-[1.03] tracking-tight text-white sm:text-6xl lg:text-7xl"
        style={{
          textShadow:
            "0 0 34px rgba(255,255,255,0.5), 0 0 78px rgba(255,255,255,0.24)",
        }}
      >
        {STARFIELD_STATEMENT}
      </h2>
    </div>
  );
}

export function Overlay({
  blockRefs,
}: {
  blockRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
}) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[52]">
      <FunnelLabelsOverlay blockRefs={blockRefs} />
      <StarfieldStatement blockRefs={blockRefs} />
      {CONTENT_SCENES.map((scene) => {
        const centered = scene.copy?.align === "center";
        return (
          <div
            key={scene.id}
            ref={(el) => {
              blockRefs.current[scene.id] = el;
            }}
            className={`absolute inset-0 flex flex-col px-6 will-change-[opacity,transform] sm:px-10 ${
              centered
                ? "items-center justify-center"
                : "items-start justify-end pb-24 sm:justify-center sm:pb-0"
            }`}
            style={{ opacity: 0 }}
          >
            {/* Legibility scrim behind copy */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background: centered
                  ? "radial-gradient(ellipse 46% 42% at 50% 47%, rgba(4,6,12,0.72) 0%, rgba(4,6,12,0.32) 46%, rgba(4,6,12,0) 74%)"
                  : "linear-gradient(90deg, rgba(4,6,12,0.72) 0%, rgba(4,6,12,0.35) 34%, rgba(4,6,12,0) 62%)",
              }}
            />
            <div className="mx-auto w-full max-w-content">
              <CopyBlock scene={scene} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
