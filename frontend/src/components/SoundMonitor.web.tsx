import { Severity } from "@/src/api";

// Web no-op: continuous mic metering for sound detection needs a native build.
export function SoundMonitor(_props: { enabled: boolean; onNoise: (s: Severity, l: string) => void }) {
  return null;
}
