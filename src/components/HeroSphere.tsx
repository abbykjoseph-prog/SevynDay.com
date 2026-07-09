"use client";

import dynamic from "next/dynamic";

// The sphere touches window/DOM (Three.js WebGL + pointer events), so it must
// only ever render on the client. next/dynamic with ssr:false is allowed here
// because this file is a Client Component.
const SevynDaySphere = dynamic(() => import("@/components/SevynDaySphere"), {
  ssr: false,
  loading: () => (
    <div aria-hidden="true" className="h-screen min-h-[600px] w-full bg-[#05070D]" />
  ),
});

export function HeroSphere() {
  // Full-bleed, full-height dark hero. The only text is the animated SEVYNDAY
  // wordmark rendered by the sphere itself — CTAs are reintroduced later.
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#05070D]">
      <SevynDaySphere />
    </section>
  );
}
