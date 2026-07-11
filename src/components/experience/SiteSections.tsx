"use client";

import Link from "next/link";
import { SCENE_BY_ID, EXPERIENCE } from "@/config/experience";

// The normal-scrolling site that the pinned WebGL experience hands off into:
// the finale "platform" panel (the orbital scene's copy, re-presented as a
// full-height landing section) followed by clearly-labeled placeholder sections.
// Shared by the animated release (Experience) and the reduced-motion fallback.

const orbital = SCENE_BY_ID.orbital.copy!;

type Btn = NonNullable<typeof orbital.buttons>[number];

function CtaButtons({ buttons }: { buttons?: Btn[] }) {
  if (!buttons) return null;
  return (
    <div className="mt-9 flex flex-wrap justify-center gap-3">
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

/**
 * The finale landing panel. Full viewport height, centered. Background is
 * transparent so the (still-visible) orbit shows through during the handoff; a
 * soft scrim keeps the copy legible. Once scrolled past, it sits on #04060c.
 */
export function PlatformPanel() {
  return (
    <section className="relative flex min-h-[100svh] items-center justify-center px-6 text-center">
      {/* Gradient softening: transparent at the top so the orbit shows through
          and DISSOLVES into the panel, fading to solid #04060c by the bottom so
          it meets the sections below with no hard edge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(4,6,12,0) 0%, rgba(4,6,12,0) 20%, rgba(4,6,12,0.82) 62%, #04060c 100%)",
        }}
      />
      {/* Radial scrim behind the copy for legibility over the orbit. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 62% 52% at 50% 50%, rgba(4,6,12,0.62) 0%, rgba(4,6,12,0.28) 52%, rgba(4,6,12,0) 80%)",
        }}
      />
      <div className="relative mx-auto max-w-3xl text-white">
        {orbital.eyebrow && (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-white/75 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2ea8ff] shadow-[0_0_8px_2px_rgba(46,168,255,0.7)]" />
            {orbital.eyebrow}
          </span>
        )}
        <h2
          className="mt-6 font-display text-4xl font-semibold leading-[1.06] tracking-tight [text-wrap:balance] sm:text-6xl"
          style={{ textShadow: "0 2px 40px rgba(4,6,12,0.75)" }}
        >
          {orbital.heading}
        </h2>
        <p
          className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg"
          style={{ textShadow: "0 1px 20px rgba(4,6,12,0.7)" }}
        >
          {orbital.sub}
        </p>
        <CtaButtons buttons={orbital.buttons} />
      </div>
    </section>
  );
}

function StubSection({ id, title }: { id: string; title: string }) {
  return (
    <section
      id={id}
      className="relative flex min-h-[70vh] flex-col items-center justify-center border-t border-white/5 px-6 text-center"
      style={{ backgroundColor: EXPERIENCE.background }}
    >
      <span className="text-xs font-medium uppercase tracking-[0.3em] text-white/40">
        {title}
      </span>
      <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 max-w-md text-sm text-white/45">
        Placeholder section — content to be added.
      </p>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer
      className="relative border-t border-white/10 px-6 py-16"
      style={{ backgroundColor: EXPERIENCE.background }}
    >
      <div className="mx-auto flex max-w-content flex-col items-center gap-3 text-center">
        <span className="font-display text-xl font-semibold tracking-tight text-white">
          SevynDay
        </span>
        <p className="text-sm text-white/45">Footer — placeholder.</p>
        <p className="text-xs text-white/30">
          © SevynDay. Content to be added.
        </p>
      </div>
    </footer>
  );
}

/** Features → How it works → Pricing → Footer, as empty labeled stubs. */
export function PlaceholderSections() {
  return (
    <>
      <StubSection id="features" title="Features" />
      <StubSection id="how-it-works" title="How it works" />
      <StubSection id="pricing" title="Pricing" />
      <SiteFooter />
    </>
  );
}
