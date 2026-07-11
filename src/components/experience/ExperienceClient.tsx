"use client";

import dynamic from "next/dynamic";
import { EXPERIENCE } from "@/config/experience";
import { useExperienceEnv } from "./useEnvironment";
import { ReducedExperience } from "./ReducedExperience";

// The Canvas touches window/WebGL, so it must only render on the client.
// next/dynamic ssr:false is allowed here because this is a Client Component.
const Experience = dynamic(
  () => import("./Experience").then((m) => m.Experience),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        className="fixed inset-0 z-50"
        style={{ backgroundColor: EXPERIENCE.background }}
      />
    ),
  },
);

export function ExperienceClient() {
  const { ready, reducedMotion, isMobile } = useExperienceEnv();

  // Until the environment is resolved, hold on a plain dark field to avoid a
  // flash of the wrong tree / hydration mismatch.
  if (!ready) {
    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 z-50"
        style={{ backgroundColor: EXPERIENCE.background }}
      />
    );
  }

  // Accessibility: users who ask for reduced motion get a static, stacked page.
  if (reducedMotion) {
    return <ReducedExperience />;
  }

  return <Experience isMobile={isMobile} reducedMotion={reducedMotion} />;
}
