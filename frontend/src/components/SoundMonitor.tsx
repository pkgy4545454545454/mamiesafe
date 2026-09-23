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
  night?: boolean;
  onNoise: (severity: Severity, label: string) => void;
};

// V1 sound-level monitor (foreground). Classifies loudness from mic metering.
// Full "shower vs scream vs fall" classification needs a native ML build; this
// V1 reacts to sustained loud sound. Requires a native build to run.
export function SoundMonitor({ enabled, night, onNoise }: Props) {
  const recorder = useAudioRecorder({ ...RecordingPresets.LOW_QUALITY, isMeteringEnabled: true });
  const samples = useRef<number[]>([]);
  const lastAlertAt = useRef(0);
  const onNoiseRef = useRef(onNoise);
  onNoiseRef.current = onNoise;
  const nightRef = useRef(!!night);
  nightRef.current = !!night;

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

            // rolling window (~21s at 1.5s/tick). metering: -160 (silence) .. 0 (loud)
            const buf = samples.current;
            buf.push(m);
            if (buf.length > 14) buf.shift();

            const now = Date.now();
            const cooldown = now - lastAlertAt.current < 60000;

            // Steady medium noise, low variance = running water / shower -> NO alert
            const recent = buf.slice(-8);
            const inWaterBand = recent.length >= 8 && recent.every((v) => v > -32 && v < -13);
            const mean = recent.reduce((a, b) => a + b, 0) / (recent.length || 1);
            const variance = recent.reduce((a, b) => a + (b - mean) ** 2, 0) / (recent.length || 1);
            if (inWaterBand && variance < 8) {
              return; // douche / eau : bruit habituel, pas d'alerte
            }
            if (cooldown) return;

            const isNight = nightRef.current;
            if (m > (isNight ? -3 : -6)) {
              // cri / impact soudain et très fort -> danger
              lastAlertAt.current = now;
              onNoiseRef.current("dangereux", isNight ? "Bruit violent la nuit" : "Bruit violent (cri ou chute possible)");
            } else if (!isNight && m > -13) {
              // bruit fort inhabituel (ignoré la nuit pour éviter les fausses alertes)
              lastAlertAt.current = now;
              onNoiseRef.current("moyen", "Bruit fort inhabituel");
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
