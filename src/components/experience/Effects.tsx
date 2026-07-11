"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  Vignette,
  ToneMapping,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { EXPERIENCE } from "@/config/experience";
import { pulse } from "./math";
import { useExperienceProgress } from "./progressDrive";

const BLOOM_BASE = 0.85;
const BLOOM_FLASH_BOOST = 3.2;

type EffectsProps = { isMobile: boolean };

// Bloom drives both the ambient glow and the scene-7 climax. During the flash
// range we ramp Bloom intensity hard (the fullscreen white plane in Experience
// supplies the rest of the blowout), then decay back.
export function Effects({ isMobile }: EffectsProps) {
  const bloom = useRef<{ intensity: number } | null>(null);
  const progress = useExperienceProgress();
  const { range, peak } = EXPERIENCE.flash;

  useFrame(() => {
    if (!bloom.current) return;
    const f = pulse(progress.current, range[0], range[1], peak);
    bloom.current.intensity = BLOOM_BASE + f * BLOOM_FLASH_BOOST;
  });

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        ref={bloom as never}
        intensity={BLOOM_BASE}
        luminanceThreshold={0.12}
        luminanceSmoothing={0.9}
        radius={isMobile ? 0.6 : 0.75}
        mipmapBlur
      />
      <Vignette eskil={false} offset={0.2} darkness={0.75} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
