import { MutableRefObject } from "react";

// Web no-op: needs the accelerometer (native build).
export function useInactivityWatch(_params: {
  enabled: boolean;
  isNight: boolean;
  interactionRef: MutableRefObject<number>;
  inactivityMs: number;
  onSilence: () => void;
}) {}
