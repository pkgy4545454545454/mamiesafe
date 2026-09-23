import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { postHeartbeat } from "@/src/api";
import { API_BASE } from "@/src/config";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === "granted") return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.status === "granted";
  } catch {
    return false;
  }
}

// Repeating "Tout va bien ?" check-in reminders on Mamie's phone (local).
export async function scheduleCheckinReminders(intervalHours: number) {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const seconds = Math.max(1, intervalHours) * 3600;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Tout va bien ? 💛",
        body: "Appuyez pour confirmer que tout va bien.",
        data: { kind: "checkin" },
      },
      trigger: { seconds, repeats: true } as Notifications.NotificationTriggerInput,
    });
  } catch {
    // ignore scheduling errors (unsupported env)
  }
}

// Local reminder to press "Je me couche" every evening at 21:00.
export async function scheduleBedtimeReminder() {
  if (Platform.OS === "web") return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Bonne nuit 🌙",
        body: "N'oubliez pas d'appuyer sur « Je me couche ».",
        data: { kind: "bedtime" },
      },
      trigger: { hour: 21, minute: 0, repeats: true } as Notifications.NotificationTriggerInput,
    });
  } catch {
    // ignore
  }
}

// Register for remote push and store the token on the backend (Python sends
// alerts to the dashboard). Works in production builds; may no-op in Expo Go.
export async function registerForPush(role: "mamie" | "dashboard") {
  if (Platform.OS === "web") return null;
  try {
    const perm = await requestNotificationPermissions();
    if (!perm) return null;
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResp.data;
    await fetch(`${API_BASE}/push/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, role }),
    });
    return token;
  } catch {
    return null;
  }
}

export async function sendHeartbeat(fallActive: boolean, listening: boolean) {
  try {
    await postHeartbeat({ fall_active: fallActive, listening });
  } catch {
    // offline is fine
  }
}
