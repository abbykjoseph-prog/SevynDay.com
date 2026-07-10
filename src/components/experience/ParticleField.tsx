"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";
import * as THREE from "three";
import { EXPERIENCE, SCENES } from "@/config/experience";
import { buildParticleBuffers } from "./shapes";
import { resolveSegment } from "./progress";
import { clamp01, lerp, windowFade } from "./math";

// Per-scene spin rate (rad/s). Zero where a still frame reads better
// (starfield, terrain). Interpolated with the same segment blend as the shapes.
const SPIN: Record<string, number> = {
  sphere: 0.14,
  funnel: 0.05,
  helix: 0.16,
  starfield: 0.0,
  terrain: 0.0,
  well: 0.06,
  flash: 0.04,
  orbital: 0.11,
};
const SPIN_BY_INDEX = SCENES.map((s) => SPIN[s.id] ?? 0.04);

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uMix;
  uniform float uSizeBase;
  uniform float uPixelRatio;
  uniform float uWaveAmt;
  uniform float uStarAmt;
  uniform float uStarPhase;
  attribute vec3 aPositionFrom;
  attribute vec3 aPositionTo;
  attribute vec3 aColorFrom;
  attribute vec3 aColorTo;
  attribute float aSize;
  attribute float aSeed;
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vec3 pos = mix(aPositionFrom, aPositionTo, uMix);

    // Wave-terrain ripple (only active while uWaveAmt > 0).
    pos.y += sin(pos.x * 1.3 + uTime * 0.9) * cos(pos.z * 1.1 + uTime * 0.6)
             * 0.22 * uWaveAmt;

    // Starfield forward stream: wrap points in z and blend in during flythrough.
    float depth = 12.0;
    float streamed = mod(pos.z + uStarPhase + 6.0, depth) - 6.0;
    pos.z = mix(pos.z, streamed, uStarAmt);

    vColor = mix(aColorFrom, aColorTo, uMix);
    vTwinkle = 0.72 + 0.28 * sin(uTime * (1.2 + aSeed * 1.5) + aSeed * 6.2831);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uSizeBase * uPixelRatio / max(0.1, -mv.z);
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  varying float vTwinkle;
  uniform float uOpacity;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;
    if (d > 1.0) discard;
    float alpha = smoothstep(1.0, 0.0, d);
    float core = smoothstep(0.55, 0.0, d);
    vec3 col = vColor * (0.45 + core * 1.1);
    gl_FragColor = vec4(col, alpha * vTwinkle * uOpacity);
  }
`;

type ParticleFieldProps = { count: number; sizeBase?: number };

export function ParticleField({ count, sizeBase = 16 }: ParticleFieldProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const scroll = useScroll();
  const lastFrom = useRef(-1);
  const starPhase = useRef(0);

  const buffers = useMemo(
    () => buildParticleBuffers(count, SCENES),
    [count],
  );

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const s0 = buffers.shapes[0];
    const s1 = buffers.shapes[1] ?? buffers.shapes[0];
    g.setAttribute("aPositionFrom", new THREE.BufferAttribute(s0.positions, 3));
    g.setAttribute("aPositionTo", new THREE.BufferAttribute(s1.positions, 3));
    g.setAttribute("aColorFrom", new THREE.BufferAttribute(s0.colors, 3));
    g.setAttribute("aColorTo", new THREE.BufferAttribute(s1.colors, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(buffers.size, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(buffers.seed, 1));
    // `position` is required by three even though the shader ignores it.
    g.setAttribute("position", new THREE.BufferAttribute(s0.positions, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);
    return g;
  }, [buffers]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMix: { value: 0 },
        uSizeBase: { value: sizeBase },
        uPixelRatio: {
          value:
            typeof window !== "undefined"
              ? Math.min(window.devicePixelRatio, EXPERIENCE.dpr[1])
              : 1,
        },
        uWaveAmt: { value: 0 },
        uStarAmt: { value: 0 },
        uStarPhase: { value: 0 },
        uOpacity: { value: 1 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
  }, [sizeBase]);

  // Dispose GPU resources on unmount / rebuild.
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05); // clamp big frame gaps (tab refocus)
    const p = clamp01(scroll.offset);
    const seg = resolveSegment(p);

    // Swap the active from/to shapes when we cross a keyframe boundary.
    if (seg.from !== lastFrom.current) {
      const from = buffers.shapes[seg.from];
      const to = buffers.shapes[seg.to] ?? from;
      geometry.setAttribute(
        "aPositionFrom",
        new THREE.BufferAttribute(from.positions, 3),
      );
      geometry.setAttribute(
        "aPositionTo",
        new THREE.BufferAttribute(to.positions, 3),
      );
      geometry.setAttribute(
        "aColorFrom",
        new THREE.BufferAttribute(from.colors, 3),
      );
      geometry.setAttribute(
        "aColorTo",
        new THREE.BufferAttribute(to.colors, 3),
      );
      lastFrom.current = seg.from;
    }

    const u = material.uniforms;
    u.uTime.value += dt;
    u.uMix.value = seg.mix;

    const waveAmt = windowFade(p, 0.46, 0.68, 0.04);
    const starAmt = windowFade(p, 0.36, 0.52, 0.04);
    u.uWaveAmt.value = waveAmt;
    u.uStarAmt.value = starAmt;
    starPhase.current += dt * 2.2 * starAmt; // only advances during flythrough
    u.uStarPhase.value = starPhase.current;

    // Per-scene spin, blended across the active segment.
    if (pointsRef.current) {
      const spin = lerp(
        SPIN_BY_INDEX[seg.from],
        SPIN_BY_INDEX[seg.to] ?? SPIN_BY_INDEX[seg.from],
        seg.mix,
      );
      pointsRef.current.rotation.y += dt * spin;
    }
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}
