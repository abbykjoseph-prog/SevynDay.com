import type { Metadata } from "next";
import { ExperienceClient } from "@/components/experience/ExperienceClient";

export const metadata: Metadata = {
  title: "Experience",
  description:
    "A cinematic scroll journey through SevynDay — one connected ecosystem for disability, leave, and absence management.",
};

// Server component: owns metadata only. The interactive WebGL experience is a
// client component, dynamically imported (ssr:false) inside ExperienceClient.
export default function ExperiencePage() {
  return <ExperienceClient />;
}
