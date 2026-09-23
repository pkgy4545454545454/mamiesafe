import { MutableRefObject, useEffect, useRef } from "react";
import { Accelerometer } from "expo-sensors";

type Params = {
  enabled: boolean;
  isNight: boolean;
  interactionRef: MutableRefObject<number>; // ms timestamp of last interaction
  inactivityMs: number;
  onSilence: () => void;
};

// "Anti-silence" watch: if Mamie hasn't MOVED (accelerometer) AND hasn't
// interacted for a long time during the day, trigger a check-in. Night time is
// skipped (no movement while sleeping is normal). Native only.
export function useInactivityWatch({ enabled, isNight, interactionRef, inactivityMs, onSilence }: Params) {
  const lastMovement = useRef(Date.now());
  const isNightRef = useRef(isNight);
  isNightRef.current = isNight;
  const onSilenceRef = useRef(onSilence);
  onSilenceRef.current = onSilence;

  useEffect(() => {
    if (!enabled) return;
    Accelerometer.setUpdateInterval(700);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const deviation = Math.abs(Math.sqrt(x * x + y * y + z * z) - 1);
      if (deviation > 0.12) lastMovement.current = Date.now();
    });

    const id = setInterval(() => {
      if (isNightRef.current) return;
      const now = Date.now();
      const noMovement = now - lastMovement.current >= inactivityMs;
      const noInteraction = now - interactionRef.current >= inactivityMs;
      if (noMovement && noInteraction) {
        lastMovement.current = now; // cooldown so it doesn't spam
        onSilenceRef.current();
      }
    }, 30000);

    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, [enabled, inactivityMs, interactionRef]);
}
