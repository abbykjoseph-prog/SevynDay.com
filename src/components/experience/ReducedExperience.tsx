"use client";

import Link from "next/link";
import { EXPERIENCE, SCENES } from "@/config/experience";
import { PlaceholderSections } from "./SiteSections";

// prefers-reduced-motion fallback: no WebGL, no scroll-jacking. A static, still
// hero over a soft radial glow, followed by the content scenes as normal
// stacked sections. Attractive and fully readable.

const contentScenes = SCENES.filter((s) => s.copy);

function CopyButtons({
  buttons,
}: {
  buttons: NonNullable<NonNullable<(typeof SCENES)[number]["copy"]>["buttons"]>;
}) {
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      {buttons.map((b) => (
        <Link
          key={b.label}
          href={b.href}
          className={
            b.variant === "primary"
              ? "inline-flex items-center rounded-full border border-white/15 bg-white px-6 py-3 text-sm font-semibold text-[#04060c] transition hover:bg-white/90"
              : "inline-flex items-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white/90 backdrop-blur transition hover:bg-white/10"
          }
        >
          {b.label}
        </Link>
      ))}
    </div>
  );
}

export function ReducedExperience() {
  const hero = SCENES[0];

  return (
    <div
      className="relative min-h-screen w-full text-white"
      style={{ backgroundColor: EXPERIENCE.background }}
    >
      {/* Static hero */}
      <section className="relative flex min-h-[92vh] items-center overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[70vh] w-[70vh] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(circle at 50% 35%, rgba(255,90,60,0.55), rgba(46,168,255,0.35) 45%, rgba(4,6,12,0) 70%)",
          }}
        />
        <div className="container-page relative">
          <div className="max-w-2xl">
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-widest text-white/70">
              {hero.copy?.eyebrow}
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
              {hero.copy?.heading}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
              {hero.copy?.sub}
            </p>
            {hero.copy?.buttons && <CopyButtons buttons={hero.copy.buttons} />}
          </div>
        </div>
      </section>

      {/* Content scenes as stacked sections */}
      {contentScenes.slice(1).map((s, i) => (
        <section
          key={s.id}
          className="relative border-t border-white/5 py-24"
          style={{
            background:
              i % 2 === 0
                ? "linear-gradient(180deg, rgba(46,168,255,0.06), rgba(4,6,12,0))"
                : "linear-gradient(180deg, rgba(255,90,60,0.06), rgba(4,6,12,0))",
          }}
        >
          <div className="container-page">
            {s.copy?.eyebrow && (
              <span className="text-xs font-medium uppercase tracking-widest text-white/50">
                {s.copy.eyebrow}
              </span>
            )}
            {s.copy?.heading && (
              <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                {s.copy.heading}
              </h2>
            )}
            {s.copy?.sub && (
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">
                {s.copy.sub}
              </p>
            )}
            {s.copy?.stats && (
              <div className="mt-8 flex flex-wrap gap-6">
                {s.copy.stats.map((st) => (
                  <div
                    key={st.label}
                    className="rounded-2xl border border-white/10 bg-white/5 px-7 py-6 backdrop-blur"
                  >
                    <div className="text-4xl font-semibold text-white">
                      {st.value}
                    </div>
                    <div className="mt-1 text-sm text-white/60">{st.label}</div>
                  </div>
                ))}
              </div>
            )}
            {s.copy?.buttons && <CopyButtons buttons={s.copy.buttons} />}
          </div>
        </section>
      ))}

      {/* Finale wordmark, then the normal-scrolling placeholder sections. */}
      <section className="relative flex min-h-[52vh] items-center justify-center border-t border-white/5 px-6 text-center">
        <span
          className="font-display text-5xl font-bold tracking-tight text-white sm:text-7xl"
          style={{ textShadow: "0 0 30px rgba(255,255,255,0.4)" }}
        >
          SEVYNDAY
        </span>
      </section>
      <PlaceholderSections />
    </div>
  );
}
