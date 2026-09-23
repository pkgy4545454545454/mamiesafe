import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ear, Moon, Phone, Warning, X } from "phosphor-react-native";

import { useConfig, useCreateAlert, useCreateEvent } from "@/src/api";
import { ESCALATION_SECONDS } from "@/src/config";
import { useFallDetection } from "@/src/hooks/useFallDetection";
import { useVoiceCommand } from "@/src/hooks/useVoiceCommand";
import { useLocationSharing } from "@/src/hooks/useLocationSharing";
import { useToast } from "@/src/components/Toast";
import { sendHeartbeat } from "@/src/notifications";
import { fonts, makeStyles, sizes, spacing, useTheme } from "@/src/theme";

type Pending = { mode: "sos" | "fall"; seconds: number } | null;

export default function Mamie() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const { data: config } = useConfig();
  const createEvent = useCreateEvent();
  const createAlert = useCreateAlert();

  const [pending, setPending] = useState<Pending>(null);
  const pendingRef = useRef<Pending>(null);
  pendingRef.current = pending;

  const emergencyNumber = config?.emergency_number ?? "112";
  const sensitivity = config?.fall_sensitivity ?? "moyenne";

  useLocationSharing(true);

  const callEmergency = useCallback(() => {
    if (Platform.OS === "web") {
      toast(`Appel des secours : ${emergencyNumber}`, "error");
      return;
    }
    Linking.openURL(`tel:${emergencyNumber}`).catch(() => {});
  }, [emergencyNumber, toast]);

  // --- Countdown for SOS / fall escalation --------------------------------
  useEffect(() => {
    if (!pending) return;
    if (pending.seconds <= 0) {
      const mode = pending.mode;
      setPending(null);
      if (mode === "sos") {
        createEvent.mutate({ type: "sos", note: "SOS déclenché" });
        createAlert.mutate({ kind: "sos", severity: "dangereux", message: "Mamie a demandé de l'aide." });
      } else {
        createEvent.mutate({ type: "fall", note: "Chute détectée, pas de réponse" });
        createAlert.mutate({ kind: "fall", severity: "dangereux", message: "Chute possible, aucune réponse de Mamie." });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      callEmergency();
      return;
    }
    const t = setTimeout(() => {
      setPending((p) => (p ? { ...p, seconds: p.seconds - 1 } : p));
    }, 1000);
    return () => clearTimeout(t);
  }, [pending, callEmergency, createAlert, createEvent]);

  const startSos = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setPending({ mode: "sos", seconds: 5 });
  }, []);

  const onFall = useCallback(() => {
    if (pendingRef.current) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    setPending({ mode: "fall", seconds: ESCALATION_SECONDS });
  }, []);

  useFallDetection(true, sensitivity, onFall);

  const onBedtime = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    createEvent.mutate({ type: "bedtime", note: "Bonne nuit" });
    toast("Bonne nuit 🌙 C'est bien noté.", "success");
  }, [createEvent, toast]);

  // --- Voice (web / native build) -----------------------------------------
  const voice = useVoiceCommand({ onSOS: startSos, onBedtime });
  useEffect(() => {
    if (voice.supported) voice.start();
    return () => voice.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.supported]);

  useEffect(() => {
    sendHeartbeat(true, voice.listening);
  }, [voice.listening]);

  const cancelPending = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPending(null);
    if (pendingRef.current?.mode === "fall") {
      createEvent.mutate({ type: "checkin", note: "Tout va bien après détection" });
      toast("Parfait, contente que tout aille bien !", "success");
    }
  };

  // long-press status to reach the caregiver dashboard
  const goDashboard = () => router.push("/unlock");

  return (
    <View style={styles.container}>
      {/* Header status */}
      <Pressable
        testID="mamie-status-header"
        onLongPress={goDashboard}
        delayLongPress={1200}
        style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
      >
        <Ear size={22} color={colors.brandPrimary} weight="fill" />
        <Text style={styles.headerText}>
          {voice.supported ? "À l'écoute — tout va bien" : "Protection active"}
        </Text>
      </Pressable>

      {/* Two giant buttons */}
      <Pressable
        testID="mamie-bedtime-button"
        onPress={onBedtime}
        style={({ pressed }) => [styles.bigButton, styles.bedBtn, { opacity: pressed ? 0.9 : 1 }]}
      >
        <Moon size={80} color={colors.onSuccess} weight="fill" />
        <Text style={[styles.bigLabel, { color: colors.onSuccess }]}>Je me couche</Text>
      </Pressable>

      <Pressable
        testID="mamie-sos-button"
        onPress={startSos}
        style={({ pressed }) => [styles.bigButton, styles.sosBtn, { opacity: pressed ? 0.9 : 1 }]}
      >
        <Warning size={80} color={colors.onError} weight="fill" />
        <Text style={[styles.bigLabel, { color: colors.onError }]}>J'ai besoin d'aide</Text>
      </Pressable>

      {voice.supported && (
        <View style={[styles.voiceHint, { bottom: insets.bottom + spacing.sm }]}>
          <Text style={styles.voiceHintText}>Vous pouvez aussi dire « à l'aide »</Text>
        </View>
      )}

      {/* Countdown overlay */}
      {pending && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>
              {pending.mode === "sos" ? "Appel des secours…" : "Ça va, Mamie ?"}
            </Text>
            <Text style={styles.overlayCount}>{pending.seconds}</Text>
            <Text style={styles.overlaySub}>
              {pending.mode === "sos"
                ? "Nous appelons de l'aide."
                : "Une chute a été détectée. Appuyez si tout va bien."}
            </Text>

            {pending.mode === "fall" && (
              <Pressable
                testID="fall-ok-button"
                onPress={cancelPending}
                style={({ pressed }) => [styles.okButton, { opacity: pressed ? 0.9 : 1 }]}
              >
                <Text style={[styles.okLabel, { color: colors.onSuccess }]}>Je vais bien</Text>
              </Pressable>
            )}

            <Pressable
              testID="cancel-emergency-button"
              onPress={cancelPending}
              style={({ pressed }) => [styles.cancelButton, { opacity: pressed ? 0.9 : 1 }]}
            >
              <X size={26} color={colors.onSurface} weight="bold" />
              <Text style={styles.cancelLabel}>Annuler</Text>
            </Pressable>

            {pending.mode === "sos" && (
              <Pressable testID="call-now-button" onPress={callEmergency} style={styles.callNow}>
                <Phone size={22} color={colors.onError} weight="fill" />
                <Text style={[styles.callNowLabel, { color: colors.onError }]}>Appeler tout de suite</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerText: { fontFamily: fonts.textBold, fontSize: sizes.lg, color: colors.muted },
  bigButton: {
    flex: 1,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  bedBtn: { backgroundColor: colors.success },
  sosBtn: { backgroundColor: colors.error },
  bigLabel: { fontFamily: fonts.display, fontSize: sizes.giant, textAlign: "center" },
  voiceHint: { position: "absolute", alignSelf: "center", paddingVertical: spacing.xs },
  voiceHintText: { fontFamily: fonts.text, fontSize: sizes.base, color: colors.muted },
  overlay: {
    ...({ position: "absolute" } as const),
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  overlayCard: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  overlayTitle: { fontFamily: fonts.display, fontSize: sizes["2xl"], color: colors.onSurface, textAlign: "center" },
  overlayCount: { fontFamily: fonts.display, fontSize: 72, color: colors.error },
  overlaySub: { fontFamily: fonts.text, fontSize: sizes.lg, color: colors.muted, textAlign: "center" },
  okButton: {
    backgroundColor: colors.success,
    minHeight: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  okLabel: { fontFamily: fonts.display, fontSize: sizes["2xl"] },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 60,
    borderRadius: 20,
    width: "100%",
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  cancelLabel: { fontFamily: fonts.textBold, fontSize: sizes.xl, color: colors.onSurface },
  callNow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.error,
    minHeight: 56,
    borderRadius: 20,
    width: "100%",
  },
  callNowLabel: { fontFamily: fonts.textBold, fontSize: sizes.lg },
}));
