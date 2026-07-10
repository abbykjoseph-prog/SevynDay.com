"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";
import * as THREE from "three";
import { clamp01, range01 } from "./math";

// Additive glow sprites that the pure-particle system can't express well:
//  - a bright hot core (sun-like) at the centre of the orbital ecosystem
//  - a soft energy core inside the hero sphere
// Both billboard the camera and fade in/out over their scroll ranges.

function makeGlowTexture() {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.22, "rgba(255,255,255,0.85)");
  g.addColorStop(0.5, "rgba(255,255,255,0.32)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export function SceneExtras() {
  const scroll = useScroll();
  const sun = useRef<THREE.Sprite>(null);
  const heroCore = useRef<THREE.Sprite>(null);

  const tex = useMemo(makeGlowTexture, []);
  const sunMat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: tex,
        color: new THREE.Color("#ffd9a8"),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        opacity: 0,
      }),
    [tex],
  );
  const heroMat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: tex,
        color: new THREE.Color("#bfe9ff"),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        opacity: 0,
      }),
    [tex],
  );

  useEffect(
    () => () => {
      tex.dispose();
      sunMat.dispose();
      heroMat.dispose();
    },
    [tex, sunMat, heroMat],
  );

  useFrame((state) => {
    const p = clamp01(scroll.offset);
    const t = state.clock.elapsedTime;

    // Orbital sun: fades in as the rings resolve, then holds; gentle pulse.
    const sunAmt = range01(p, 0.83, 0.88);
    if (sun.current) {
      const pulse = 1 + 0.04 * Math.sin(t * 1.6);
      sun.current.scale.setScalar(3.1 * pulse);
      sunMat.opacity = sunAmt * (0.85 + 0.15 * Math.sin(t * 2.2));
      sun.current.visible = sunAmt > 0.001;
    }

    // Hero core: soft glow at the sphere centre, fades out leaving the hero.
    const heroAmt = 1 - range01(p, 0.05, 0.1);
    if (heroCore.current) {
      heroCore.current.scale.setScalar(1.25 + 0.05 * Math.sin(t * 1.1));
      heroMat.opacity = heroAmt * 0.5;
      heroCore.current.visible = heroAmt > 0.001;
    }
  });

  return (
    <>
      <sprite ref={sun} material={sunMat} position={[0, 0, 0]} />
      <sprite ref={heroCore} material={heroMat} position={[0, 0, 0]} />
    </>
  );
}
