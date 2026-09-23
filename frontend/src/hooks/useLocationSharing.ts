import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { Platform } from "react-native";

import { postLocation } from "@/src/api";

type PermState = "unknown" | "granted" | "denied" | "blocked";

// Requests foreground location, pushes Mamie's position to the backend, and
// keeps sharing it periodically while enabled.
export function useLocationSharing(enabled: boolean) {
  const [permission, setPermission] = useState<PermState>("unknown");
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const shareOnce = useCallback(async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await postLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? undefined,
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const requestAndShare = useCallback(async () => {
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        setPermission("granted");
        await shareOnce();
        return "granted" as const;
      }
      setPermission(canAskAgain ? "denied" : "blocked");
      return canAskAgain ? ("denied" as const) : ("blocked" as const);
    } catch {
      setPermission("denied");
      return "denied" as const;
    }
  }, [shareOnce]);

  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;
    let mounted = true;
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (!mounted) return;
      if (status !== "granted") {
        setPermission("denied");
        return;
      }
      setPermission("granted");
      await shareOnce();
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 60000, distanceInterval: 25 },
        (pos) => {
          postLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? undefined,
          }).catch(() => {});
        },
      );
    })();
    return () => {
      mounted = false;
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [enabled, shareOnce]);

  return { permission, requestAndShare, shareOnce };
}
