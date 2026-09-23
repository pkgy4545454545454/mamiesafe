import { useEffect } from "react";
import { Platform, Vibration } from "react-native";
import { useAudioPlayer } from "expo-audio";

// Public alarm tone (loops on Android; iOS may skip .ogg — vibration still runs).
const ALARM_URL = "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg";

// Rings + vibrates the phone insistently while `active` is true, and stops when
// it turns false. Used for the check-in prompt and activity confirmation.
export function useInsistentAlarm(active: boolean) {
  const player = useAudioPlayer(ALARM_URL);

  useEffect(() => {
    if (!active) return;
    if (Platform.OS !== "web") {
      Vibration.vibrate([0, 700, 400, 700, 400], true);
    }
    try {
      player.loop = true;
      player.seekTo(0);
      player.play();
    } catch {
      // audio may be unavailable — vibration/notifications still cover it
    }
    return () => {
      if (Platform.OS !== "web") Vibration.cancel();
      try {
        player.pause();
      } catch {
        // ignore
      }
    };
  }, [active, player]);
}
