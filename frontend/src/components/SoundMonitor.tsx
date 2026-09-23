import { useEffect, useRef } from "react";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";

import { Severity } from "@/src/api";

type Props = {
  enabled: boolean;
  onNoise: (severity: Severity, label: string) => void;
};

// V1 sound-level monitor (foreground). Classifies loudness from mic metering.
// Full "shower vs scream vs fall" classification needs a native ML build; this
// V1 reacts to sustained loud sound. Requires a native build to run.
export function SoundMonitor({ enabled, onNoise }: Props) {
  const recorder = useAudioRecorder({ ...RecordingPresets.LOW_QUALITY, isMeteringEnabled: true });
  const loudStreak = useRef(0);
  const lastAlertAt = useRef(0);
  const onNoiseRef = useRef(onNoise);
  onNoiseRef.current = onNoise;

  useEffect(() => {
    if (!enabled) return;
    let interval: ReturnType<typeof setInterval> | null = null;
    let active = true;

    (async () => {
      try {
        const perm = await requestRecordingPermissionsAsync();
        if (!perm.granted || !active) return;
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();

        interval = setInterval(() => {
          try {
            const status = recorder.getStatus();
            const m = status?.metering;
            if (typeof m !== "number") return;
            // metering: ~ -160 (silence) .. 0 (max loudness)
            if (m > -12) {
              loudStreak.current += 1;
            } else if (m > -22) {
              loudStreak.current += 0.5;
            } else {
              loudStreak.current = 0;
            }
            const now = Date.now();
            if (loudStreak.current >= 3 && now - lastAlertAt.current > 60000) {
              lastAlertAt.current = now;
              loudStreak.current = 0;
              const severity: Severity = m > -6 ? "dangereux" : "moyen";
              onNoiseRef.current(severity, m > -6 ? "Bruit fort et soudain" : "Bruit inhabituel");
            }
          } catch {
            // ignore per-tick errors
          }
        }, 1500);
      } catch {
        // audio unavailable (e.g. Expo Go / web) — silently no-op
      }
    })();

    return () => {
      active = false;
      if (interval) clearInterval(interval);
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return null;
}
