"use client";

import type { MutableRefObject } from "react";
import { PROGRESS_STAGES, PROGRESS_DOTS } from "@/config/experience";

// Scroll-progress indicator: a vertical row of dots on the right edge, one per
// CONTENT stage (six). Each dot is a dim base with an electric-blue "active"
// overlay; the active overlay's opacity and the dot's scale are driven per frame
// in Experience's handleFrame (keys `stage-0..N`), so the highlight eases from
// one dot to the next across transitions. No autonomous pulse (reduced-motion
// friendly) — the only motion is the scroll-driven ease + a fade on handoff.
//
// Dots are CLICKABLE: clicking one calls `onStageClick(i)`, which navigates to
// that stage using the same smooth transition logic as scrolling (see
// Experience). `dimmed` shrinks + dims the whole column once the finale has
// handed off to the normal scrolling site, keeping them present but unobtrusive.
export function ProgressDots({
  blockRefs,
  isMobile,
  visible,
  dimmed,
  onStageClick,
}: {
  blockRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  isMobile: boolean;
  visible: boolean;
  dimmed: boolean;
  onStageClick: (index: number) => void;
}) {
  const { sizePx, gapPx, activeColor, inactiveColor, glow } = PROGRESS_DOTS;
  const size = isMobile ? Math.max(6, sizePx - 1) : sizePx;
  const gap = isMobile ? Math.max(12, gapPx - 5) : gapPx;

  return (
    <div
      className="fixed right-3 top-1/2 z-[53] flex -translate-y-1/2 flex-col items-center sm:right-6"
      style={{
        gap: `${dimmed ? gap - 4 : gap}px`,
        // Present throughout; dimmed + smaller once handed off so it doesn't
        // compete with normal page content, still clickable to jump back in.
        opacity: visible ? (dimmed ? 0.45 : 1) : 0,
        transform: `scale(${dimmed ? 0.8 : 1})`,
        transformOrigin: "right center",
        transition: "opacity 500ms ease, transform 500ms ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {PROGRESS_STAGES.map((s, i) => (
        <button
          key={s.id}
          type="button"
          aria-label={`Go to ${s.name}`}
          onClick={() => onStageClick(i)}
          className="group flex cursor-pointer items-center justify-center p-1.5 transition-transform duration-200 hover:scale-110"
        >
          {/* Dot: dim base + active blue overlay (opacity/scale driven per frame). */}
          <div
            ref={(el) => {
              blockRefs.current[`stage-${i}`] = el;
            }}
            className="relative block will-change-transform"
            style={{ width: `${size}px`, height: `${size}px` }}
          >
            <span
              className="absolute inset-0 rounded-full transition-[filter] duration-200 group-hover:brightness-150"
              style={{ backgroundColor: inactiveColor }}
            />
            <span
              data-active
              className="absolute inset-0 rounded-full"
              style={{ backgroundColor: activeColor, boxShadow: glow, opacity: 0 }}
            />
          </div>
        </button>
      ))}
    </div>
  );
}
