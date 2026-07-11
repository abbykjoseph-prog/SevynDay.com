"use client";

import type { MutableRefObject } from "react";
import { PROGRESS_STAGES, PROGRESS_DOTS } from "@/config/experience";

// Scroll-progress indicator: a vertical row of dots on the right edge, one per
// CONTENT stage. Each dot is a dim base with an electric-blue "active" overlay
// on top; the active overlay's opacity and the dot's scale are driven per frame
// in Experience's handleFrame (keys `stage-0..N`), so the highlight eases from
// one dot to the next across transitions. No autonomous pulse (reduced-motion
// friendly) — the only motion is the scroll-driven ease + a fade on handoff.
export function ProgressDots({
  blockRefs,
  isMobile,
  visible,
}: {
  blockRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  isMobile: boolean;
  visible: boolean;
}) {
  const { sizePx, gapPx, activeColor, inactiveColor, glow } = PROGRESS_DOTS;
  const size = isMobile ? Math.max(6, sizePx - 1) : sizePx;
  const gap = isMobile ? Math.max(12, gapPx - 5) : gapPx;

  return (
    <div
      className="pointer-events-none fixed right-3 top-1/2 z-[53] flex -translate-y-1/2 flex-col items-center sm:right-6"
      style={{
        gap: `${gap}px`,
        opacity: visible ? 1 : 0,
        transition: "opacity 400ms ease",
      }}
    >
      {PROGRESS_STAGES.map((s, i) => (
        <div
          key={s.id}
          className="group pointer-events-auto relative flex items-center justify-center"
        >
          {/* Hover label (desktop nicety) — the stage name to the left of the dot. */}
          <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-md bg-black/55 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white/85 opacity-0 backdrop-blur transition-opacity duration-200 group-hover:opacity-100">
            {s.name}
          </span>
          {/* Dot: dim base + active blue overlay (opacity/scale driven per frame). */}
          <div
            ref={(el) => {
              blockRefs.current[`stage-${i}`] = el;
            }}
            className="relative will-change-transform"
            style={{ width: `${size}px`, height: `${size}px` }}
          >
            <span
              className="absolute inset-0 rounded-full"
              style={{ backgroundColor: inactiveColor }}
            />
            <span
              data-active
              className="absolute inset-0 rounded-full"
              style={{ backgroundColor: activeColor, boxShadow: glow, opacity: 0 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
