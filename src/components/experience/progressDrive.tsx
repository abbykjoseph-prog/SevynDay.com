"use client";

import {
  createContext,
  useContext,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";

// The ONE progress value every scene animation reads (`progress.current`, 0..1).
// It is written each frame by the snap driver in Experience (SnapDriver), which
// tweens it between stage targets on a scroll gesture. Consumers read it inside
// their own useFrame — this module only shares the ref via context.
const ProgressContext = createContext<MutableRefObject<number> | null>(null);

export function useExperienceProgress(): MutableRefObject<number> {
  const ctx = useContext(ProgressContext);
  if (!ctx) {
    throw new Error(
      "useExperienceProgress must be used within <ProgressProvider>",
    );
  }
  return ctx;
}

export function ProgressProvider({
  progress,
  children,
}: {
  progress: MutableRefObject<number>;
  children: ReactNode;
}) {
  return (
    <ProgressContext.Provider value={progress}>
      {children}
    </ProgressContext.Provider>
  );
}
