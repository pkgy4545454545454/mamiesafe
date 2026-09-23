import { useEffect, useRef } from "react";
import { Accelerometer } from "expo-sensors";
import { Platform } from "react-native";

import { FALL_SENSITIVITY } from "@/src/config";

type Sensitivity = "basse" | "moyenne" | "haute";

// Detects a hard impact followed by a period of immobility -> possible fall.
// Tuned to avoid false alarms: a big movement during the quiet window cancels it.
export function useFallDetection(
  enabled: boolean,
  sensitivity: Sensitivity,
  onFall: () => void,
) {
  const impactAt = useRef<number | null>(null);
  const maxDeviationDuringQuiet = useRef(0);
  const onFallRef = useRef(onFall);
  onFallRef.current = onFall;

  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;

    const cfg = FALL_SENSITIVITY[sensitivity] ?? FALL_SENSITIVITY.moyenne;
    Accelerometer.setUpdateInterval(200);

    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z); // ~1 at rest (g)
      const deviation = Math.abs(magnitude - 1);
      const now = Date.now();

      if (impactAt.current === null) {
        // Looking for a hard impact spike.
        if (magnitude >= cfg.impactG) {
          impactAt.current = now;
          maxDeviationDuringQuiet.current = 0;
        }
      } else {
        // In the quiet window after an impact.
        maxDeviationDuringQuiet.current = Math.max(
          maxDeviationDuringQuiet.current,
          deviation,
        );
        const elapsed = (now - impactAt.current) / 1000;

        // Strong movement = she got up / picked the phone = not a fall.
        if (deviation > 0.6 && elapsed > 0.8) {
          impactAt.current = null;
          return;
        }
        // Stayed still long enough -> possible fall.
        if (elapsed >= cfg.quietSeconds && maxDeviationDuringQuiet.current < 0.35) {
          impactAt.current = null;
          onFallRef.current();
        } else if (elapsed >= cfg.quietSeconds) {
          impactAt.current = null; // moved around, reset
        }
      }
    });

    return () => sub.remove();
  }, [enabled, sensitivity]);
}
