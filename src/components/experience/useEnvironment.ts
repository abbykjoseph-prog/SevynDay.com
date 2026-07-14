"use client";

import { useEffect, useState } from "react";

/** SSR-safe `matchMedia` subscription. Returns `false` until mounted. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export const usePrefersReducedMotion = () =>
  useMediaQuery("(prefers-reduced-motion: reduce)");

export const useIsMobile = () => useMediaQuery("(max-width: 767px)");

/**
 * Resolves the environment once mounted. `ready` guards against SSR/first-paint
 * so we never flash the wrong (animated vs static) tree or hydrate mismatched.
 */
export function useExperienceEnv() {
  const reducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile();
  const [ready, setReady] = useState(false);
  // URL escape hatches (read after mount so they stay SSR-safe):
  //   ?reduced — force the static fallback (QA).
  //   ?motion  — force the full animated experience even when the OS asks for
  //              reduced motion (a shareable override for client demos, where we
  //              can't control the visitor's accessibility settings).
  // Explicit ?motion wins over both the OS setting and ?reduced.
  const [forceReduced, setForceReduced] = useState(false);
  const [forceMotion, setForceMotion] = useState(false);
  useEffect(() => {
    setReady(true);
    const params = new URLSearchParams(window.location.search);
    setForceReduced(params.has("reduced"));
    setForceMotion(params.has("motion"));
  }, []);
  return {
    ready,
    reducedMotion: forceMotion ? false : reducedMotion || forceReduced,
    isMobile,
  };
}
