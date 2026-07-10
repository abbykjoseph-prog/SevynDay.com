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
  // `?reduced` forces the static fallback (QA + a manual escape hatch). Read
  // after mount so it stays SSR-safe.
  const [forceReduced, setForceReduced] = useState(false);
  useEffect(() => {
    setReady(true);
    setForceReduced(/reduced/.test(window.location.search));
  }, []);
  return {
    ready,
    reducedMotion: reducedMotion || forceReduced,
    isMobile,
  };
}
