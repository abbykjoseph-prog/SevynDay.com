"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";
import * as THREE from "three";
import { SCENES } from "@/config/experience";
import { resolveSegment } from "./progress";
import { clamp01, lerp } from "./math";

// Camera keyframes per scene (aligned to SCENES order). Position + look target.
// Tunable here — this is the "camera path" referenced in BUILD_NOTES.
type CamKey = { pos: [number, number, number]; tgt: [number, number, number] };

const CAM: Record<string, CamKey> = {
  sphere: { pos: [0, 0, 5.4], tgt: [0, 0, 0] },
  funnel: { pos: [0, 0.25, 4.2], tgt: [0, -0.5, 0] },
  helix: { pos: [0, 0, 4.7], tgt: [0, 0, 0] },
  starfield: { pos: [0, 0, 3.1], tgt: [0, 0, -1.2] },
  terrain: { pos: [0, 2.35, 5.3], tgt: [0, -0.55, -1.3] },
  well: { pos: [0, 3.1, 3.9], tgt: [0, 0, -0.2] },
  flash: { pos: [0, 0.4, 4.4], tgt: [0, 0, 0] },
  orbital: { pos: [0, 0.65, 6.7], tgt: [0, 0, 0] },
};
const CAM_BY_INDEX = SCENES.map((s) => CAM[s.id]);

export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const scroll = useScroll();
  const target = useRef(new THREE.Vector3());

  useFrame((state) => {
    const p = clamp01(scroll.offset);
    const seg = resolveSegment(p);
    const a = CAM_BY_INDEX[seg.from];
    const b = CAM_BY_INDEX[seg.to] ?? a;
    const m = seg.mix;

    // Gentle parallax drift from the pointer for life.
    const px = state.pointer.x * 0.18;
    const py = state.pointer.y * 0.12;

    camera.position.set(
      lerp(a.pos[0], b.pos[0], m) + px,
      lerp(a.pos[1], b.pos[1], m) + py,
      lerp(a.pos[2], b.pos[2], m),
    );
    target.current.set(
      lerp(a.tgt[0], b.tgt[0], m),
      lerp(a.tgt[1], b.tgt[1], m),
      lerp(a.tgt[2], b.tgt[2], m),
    );
    camera.lookAt(target.current);
  });

  return null;
}
