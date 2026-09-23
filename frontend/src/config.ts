// App-wide constants and storage keys.
export const API_BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export const STORAGE_KEYS = {
  onboarded: "mamiesafe.onboarded",
};

// Fall-detection thresholds (in g). Impact peak then immobility window.
// Higher threshold = less sensitive (fewer false alarms).
export const FALL_SENSITIVITY = {
  basse: { impactG: 3.4, quietSeconds: 6 },
  moyenne: { impactG: 2.9, quietSeconds: 5 },
  haute: { impactG: 2.4, quietSeconds: 4 },
};

// Delay before a possible-fall / voice alert auto-escalates (seconds).
export const ESCALATION_SECONDS = 30;
