"use client";

import Link from "next/link";
import type { MutableRefObject } from "react";
import { SCENES, type SceneDef } from "@/config/experience";

// The HTML content layer for the anchor scenes (sphere, helix, terrain,
// orbital). Rendered as a fixed layer above the Canvas; each block's opacity /
// transform / pointer-events are driven per frame from the scroll offset by
// Experience (see handleFrame), so blocks cross-fade as their scene arrives.

export const CONTENT_SCENES: SceneDef[] = SCENES.filter((s) => s.copy);

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-white/75 backdrop-blur">
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
    <div className="mt-9 flex flex-wrap gap-3">
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
      {copy.eyebrow && <Pill>{copy.eyebrow}</Pill>}
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

export function Overlay({
  blockRefs,
}: {
  blockRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
}) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[52]">
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
