"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EXPERIENCE, SCENES } from "@/config/experience";
import { buildParticleBuffers } from "./shapes";
import { resolveSegment } from "./progress";
import { lerp, windowFade } from "./math";
import { useExperienceProgress } from "./progressDrive";

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
  const progress = useExperienceProgress();
  const lastFrom = useRef(-1);
  const lastTo = useRef(-1);
  const starPhase = useRef(0);

  const buffers = useMemo(
    () => buildParticleBuffers(count, SCENES),
    [count],
  );

  // One persistent BufferAttribute per shape, created ONCE. Reusing these exact
  // objects when the active shapes change lets three keep every buffer
  // GPU-resident and skip re-uploading. The old code allocated four fresh
  // attributes (~600k floats) on every scene boundary and re-uploaded them,
  // hitching precisely at the transitions.
  const shapeAttrs = useMemo(
    () =>
      buffers.shapes.map((s) => ({
        pos: new THREE.BufferAttribute(s.positions, 3),
        col: new THREE.BufferAttribute(s.colors, 3),
      })),
    [buffers],
  );

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const a0 = shapeAttrs[0];
    const a1 = shapeAttrs[1] ?? shapeAttrs[0];
    g.setAttribute("aPositionFrom", a0.pos);
    g.setAttribute("aPositionTo", a1.pos);
    g.setAttribute("aColorFrom", a0.col);
    g.setAttribute("aColorTo", a1.col);
    g.setAttribute("aSize", new THREE.BufferAttribute(buffers.size, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(buffers.seed, 1));
    // `position` is required by three even though the shader ignores it.
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(buffers.shapes[0].positions, 3),
    );
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);
    return g;
  }, [shapeAttrs, buffers]);

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
    const p = progress.current;
    const seg = resolveSegment(p);

    // Rebind the active from/to shapes when the segment changes. These
    // BufferAttribute objects are reused, so three keeps them GPU-resident and
    // does NOT re-upload — no hitch at the transition.
    if (seg.from !== lastFrom.current || seg.to !== lastTo.current) {
      const fromA = shapeAttrs[seg.from];
      const toA = shapeAttrs[seg.to] ?? fromA;
      geometry.setAttribute("aPositionFrom", fromA.pos);
      geometry.setAttribute("aPositionTo", toA.pos);
      geometry.setAttribute("aColorFrom", fromA.col);
      geometry.setAttribute("aColorTo", toA.col);
      lastFrom.current = seg.from;
      lastTo.current = seg.to;
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
