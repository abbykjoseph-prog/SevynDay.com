import { ExperienceClient } from "@/components/experience/ExperienceClient";

// The cinematic scroll experience is the homepage. Metadata comes from the root
// layout (site title + description), which is the right default for `/`. The
// interactive WebGL experience is a client component, dynamically imported
// (ssr:false) inside ExperienceClient.
//
// The previous marketing homepage is preserved verbatim at /classic.
export default function HomePage() {
  return <ExperienceClient />;
}
