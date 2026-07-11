"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { FUNNEL_BLOCKS } from "@/config/experience";
import { useExperienceProgress } from "./progressDrive";
import { resolveSpin } from "./progress";
import { range01, smoothstep } from "./math";

// Three real 3D text labels (drei/Troika <Text>) on a downward spiral that hugs
// the funnel's surface: 120° apart in azimuth, at descending heights and
// shrinking radii (the funnel narrows toward the bottom). The whole spiral
// orbits around the funnel's Y axis in sync with the funnel's own spin
// (resolveSpin — the exact clock the particle field uses), so they turn like a
// carousel. Each label's yaw is biased toward the camera so it never goes
// edge-on — legibility first.

type TroikaText = Omit<THREE.Mesh, "material"> & {
  material: THREE.Material;
  fillOpacity: number;
  outlineOpacity: number;
  sync: () => void;
};

const D2R = Math.PI / 180;

// Azimuths are 120° apart; chosen so the three read roughly top-left / middle /
// lower-right on screen. Radius shrinks and height descends with the funnel.
const LAYOUT = [
  { az: 150 * D2R, r: 1.45, y: 0.6 }, //  "Instant Adjudication" — top-left (front)
  { az: 270 * D2R, r: 1.1, y: -0.2 }, //  "Forensic Papertrail"  — middle (center)
  { az: 30 * D2R, r: 0.8, y: -1.0 }, //   "Effortless Caseload"  — lower-right (front)
];

// 1 = always fully faces the camera; a touch under keeps a little funnel tilt.
const CAMERA_BIAS = 0.82;

// Group fades in TOGETHER (fully visible by ~p=0.04) and fades out as the
// funnel's exit transition to the helix begins (~p=0.175).
const FADE_IN: [number, number] = [0.015, 0.04];
const FADE_OUT: [number, number] = [0.175, 0.215];

export function FunnelLabels() {
  const progress = useExperienceProgress();
  const camera = useThree((s) => s.camera);
  const groupRef = useRef<THREE.Group>(null);
  const refs = useRef<(TroikaText | null)[]>([]);
  const rot = useRef(0); // accumulated funnel rotation (matches the particles)
  const lastOp = useRef(-1);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const p = progress.current;
    rot.current += dt * resolveSpin(p); // orbit in lockstep with the funnel

    const op = smoothstep(
      Math.min(
        range01(p, FADE_IN[0], FADE_IN[1]),
        1 - range01(p, FADE_OUT[0], FADE_OUT[1]),
      ),
    );
    const g = groupRef.current;
    if (g) g.visible = op > 0.001;
    if (op <= 0.001) {
      lastOp.current = op;
      return;
    }

    // Only re-sync Troika when the group opacity actually changes (during the
    // fades); position/rotation are plain mesh transforms and need no sync.
    const opChanged = Math.abs(op - lastOp.current) > 0.006;

    for (let i = 0; i < LAYOUT.length; i++) {
      const t = refs.current[i];
      if (!t) continue;
      const L = LAYOUT[i];
      const ang = L.az + rot.current;
      const px = L.r * Math.cos(ang);
      const pz = L.r * Math.sin(ang);
      t.position.set(px, L.y, pz);

      // Yaw = blend of radial-outward (funnel tilt) and facing the camera,
      // biased toward the camera. Upright (no pitch/roll) for readability.
      const outX = Math.cos(ang);
      const outZ = Math.sin(ang);
      let camX = camera.position.x - px;
      let camZ = camera.position.z - pz;
      const cl = Math.hypot(camX, camZ) || 1;
      camX /= cl;
      camZ /= cl;
      const dirX = outX * (1 - CAMERA_BIAS) + camX * CAMERA_BIAS;
      const dirZ = outZ * (1 - CAMERA_BIAS) + camZ * CAMERA_BIAS;
      t.rotation.set(0, Math.atan2(dirX, dirZ), 0);

      // Always draw on top of the additive particles so the text stays crisp.
      t.renderOrder = 12;
      if (t.material) {
        t.material.depthTest = false;
        t.material.transparent = true;
      }

      if (opChanged) {
        t.fillOpacity = op;
        t.outlineOpacity = op * 0.85;
        t.sync();
      }
    }
    if (opChanged) lastOp.current = op;
  });

  return (
    <group ref={groupRef} visible={false}>
      {FUNNEL_BLOCKS.map((label, i) => (
        <Text
          key={label}
          ref={(el) => {
            refs.current[i] = el as unknown as TroikaText;
          }}
          fontSize={0.24}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          letterSpacing={-0.01}
          outlineWidth={0.014}
          outlineColor="#04060c"
          outlineBlur={0.014}
          fillOpacity={0}
          outlineOpacity={0}
        >
          {label}
        </Text>
      ))}
    </group>
  );
}
