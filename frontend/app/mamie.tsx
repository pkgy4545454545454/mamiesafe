import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle, Drop, Ear, Moon, Phone, Warning, X } from "phosphor-react-native";

import {
  useActivities,
  useConfig,
  useConfirmActivity,
  useCreateActivity,
  useCreateAlert,
  useCreateEvent,
  usePhotoRequests,
  type Severity,
} from "@/src/api";
import { ESCALATION_SECONDS } from "@/src/config";
import { useFallDetection } from "@/src/hooks/useFallDetection";
import { useVoiceCommand } from "@/src/hooks/useVoiceCommand";
import { useLocationSharing } from "@/src/hooks/useLocationSharing";
import { useToast } from "@/src/components/Toast";
import { sendHeartbeat } from "@/src/notifications";
import { sendSmsToContacts } from "@/src/sms";
import { PhotoRequestModal } from "@/src/components/PhotoRequestModal";
import { SoundMonitor } from "@/src/components/SoundMonitor";
import { useInsistentAlarm } from "@/src/hooks/useInsistentAlarm";
import { useInactivityWatch } from "@/src/hooks/useInactivityWatch";
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
  const createActivity = useCreateActivity();
  const confirmActivity = useConfirmActivity();
  const { data: awaiting } = useActivities("awaiting_confirmation");
  const contacts = config?.contacts ?? [];

  const { data: photoReqs } = usePhotoRequests("pending");
  const [dismissedPhoto, setDismissedPhoto] = useState<string[]>([]);
  const pendingPhoto = (photoReqs ?? []).find((p) => !dismissedPhoto.includes(p.id));

  const soundEnabled = !!config?.sound_detection && Platform.OS !== "web";
  const onNoise = useCallback(
    (severity: Severity, label: string) => {
      createAlert.mutate({ kind: "noise", severity, message: label });
    },
    [createAlert],
  );

  const [pending, setPending] = useState<Pending>(null);
  const pendingRef = useRef<Pending>(null);
  pendingRef.current = pending;

  const [checkinActive, setCheckinActive] = useState(false);
  const lastCheckAt = useRef(Date.now());
  const ringCount = useRef(0);
  const escalatedRef = useRef(false);
  const touch = useCallback(() => {
    lastCheckAt.current = Date.now();
  }, []);

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
        sendSmsToContacts(
          contacts,
          `${config?.mamie_name ?? "Mamie"} a besoin d'aide ! Merci de la contacter ou de passer la voir.`,
        );
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
  }, [pending, callEmergency, createAlert, createEvent, contacts, config]);

  const startSos = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    touch();
    setPending({ mode: "sos", seconds: 5 });
  }, [touch]);

  const onFall = useCallback(() => {
    if (pendingRef.current) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    setPending({ mode: "fall", seconds: ESCALATION_SECONDS });
  }, []);

  useFallDetection(true, sensitivity, onFall);

  const onBedtime = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    touch();
    createEvent.mutate({ type: "bedtime", note: "Bonne nuit" });
    toast("Bonne nuit 🌙 C'est bien noté.", "success");
  }, [createEvent, toast, touch]);

  const onShower = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    touch();
    createActivity.mutate({
      title: "Douche",
      kind: "shower",
      start_at: new Date().toISOString(),
      end_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      grace_minutes: 5,
    });
    toast("Bonne douche 🚿 Je préviens la famille.", "info");
  }, [createActivity, toast, touch]);

  const onSmsContacts = useCallback(() => {
    sendSmsToContacts(
      contacts,
      `${config?.mamie_name ?? "Mamie"} a besoin d'aide ! Merci de la contacter ou de passer la voir.`,
    ).then((r) => {
      if (r === "unavailable") toast("Aucun contact enregistré ou SMS indisponible", "error");
    });
  }, [contacts, config, toast]);

  const activePrompt = awaiting && awaiting.length > 0 ? awaiting[0] : null;

  const confirmDone = useCallback(() => {
    if (!activePrompt) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    lastCheckAt.current = Date.now();
    confirmActivity.mutate({ id: activePrompt.id, status: "confirmed" });
    toast("Merci ! C'est bien noté ✅", "success");
  }, [activePrompt, confirmActivity, toast]);

  // Insistent alarm (ring + vibrate) while a check-in or activity awaits.
  useInsistentAlarm(checkinActive || !!activePrompt);

  const intervalMs = Math.max(1, config?.checkin_interval_hours ?? 4) * 3600 * 1000;

  // Detect when a check-in is due (foreground, app open on Mamie's phone).
  useEffect(() => {
    const id = setInterval(() => {
      if (pendingRef.current || pendingPhoto || activePrompt || checkinActive) return;
      if (Date.now() - lastCheckAt.current >= intervalMs) setCheckinActive(true);
    }, 15000);
    return () => clearInterval(id);
  }, [intervalMs, pendingPhoto, activePrompt, checkinActive]);

  // Count rings; escalate after ~20 rings (~1 min) without response.
  useEffect(() => {
    if (!checkinActive) {
      ringCount.current = 0;
      escalatedRef.current = false;
      return;
    }
    const id = setInterval(() => {
      ringCount.current += 1;
      if (ringCount.current >= 20 && !escalatedRef.current) {
        escalatedRef.current = true;
        createAlert.mutate({
          kind: "missed_checkin",
          severity: "dangereux",
          message: "Mamie ne répond pas au check-in.",
        });
        const num = contacts.find((c) => c.primary)?.phone || contacts[0]?.phone || emergencyNumber;
        if (Platform.OS !== "web" && num) Linking.openURL(`tel:${num}`).catch(() => {});
      }
    }, 3000);
    return () => clearInterval(id);
  }, [checkinActive, createAlert, contacts, emergencyNumber]);

  const onCheckinOk = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    lastCheckAt.current = Date.now();
    ringCount.current = 0;
    escalatedRef.current = false;
    setCheckinActive(false);
    createEvent.mutate({ type: "checkin", note: "Tout va bien" });
    toast("Merci ! Content que tout aille bien 💛", "success");
  }, [createEvent, toast]);

  // Night mode: quieter noise thresholds during sleeping hours.
  const nightStart = config?.night_start ?? 22;
  const nightEnd = config?.night_end ?? 7;
  const hourNow = new Date().getHours();
  const inNightWindow =
    nightStart <= nightEnd
      ? hourNow >= nightStart && hourNow < nightEnd
      : hourNow >= nightStart || hourNow < nightEnd;
  const isNight = (config?.night_mode ?? true) && inNightWindow;

  // Anti-silence watch: no movement + no interaction during the day -> check-in.
  const inactivityMs = Math.max(1, config?.inactivity_hours ?? 4) * 3600 * 1000;
  const onSilence = useCallback(() => setCheckinActive(true), []);
  useInactivityWatch({
    enabled: (config?.inactivity_watch ?? true) && Platform.OS !== "web",
    isNight,
    interactionRef: lastCheckAt,
    inactivityMs,
    onSilence,
  });

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
    lastCheckAt.current = Date.now();
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
          {isNight
            ? "Mode nuit 🌙 — protection active"
            : voice.supported
              ? "À l'écoute — tout va bien"
              : "Protection active"}
        </Text>
      </Pressable>

      {/* Persistent urgent confirmation banner (shower / scheduled activity) */}
      {activePrompt && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.urgent} testID="activity-prompt-banner">
          <Text style={styles.urgentTitle}>
            {activePrompt.kind === "shower" ? "Avez-vous fini votre douche ?" : `Avez-vous fini : ${activePrompt.title} ?`}
          </Text>
          <Pressable testID="activity-done-button" onPress={confirmDone} style={styles.urgentButton}>
            <CheckCircle size={44} color={colors.onSuccess} weight="fill" />
            <Text style={[styles.urgentButtonText, { color: colors.onSuccess }]}>J'ai fini</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Two giant buttons */}
      <Pressable
        testID="mamie-bedtime-button"
        onPress={onBedtime}
        style={({ pressed }) => [styles.bigButton, styles.bedBtn, { opacity: pressed ? 0.9 : 1 }]}
      >
        <Moon size={64} color={colors.onSuccess} weight="fill" />
        <Text style={[styles.bigLabel, { color: colors.onSuccess }]}>Je me couche</Text>
      </Pressable>

      <Pressable
        testID="mamie-shower-button"
        onPress={onShower}
        style={({ pressed }) => [styles.bigButton, styles.showerBtn, { opacity: pressed ? 0.9 : 1 }]}
      >
        <Drop size={64} color={colors.onInfo} weight="fill" />
        <Text style={[styles.bigLabel, { color: colors.onInfo }]}>Je me douche</Text>
      </Pressable>

      <Pressable
        testID="mamie-sos-button"
        onPress={startSos}
        style={({ pressed }) => [styles.bigButton, styles.sosBtn, { opacity: pressed ? 0.9 : 1 }]}
      >
        <Warning size={64} color={colors.onError} weight="fill" />
        <Text style={[styles.bigLabel, { color: colors.onError }]}>J'ai besoin d'aide</Text>
      </Pressable>

      {voice.supported && (
        <View style={[styles.voiceHint, { bottom: insets.bottom + spacing.sm }]}>
          <Text style={styles.voiceHintText}>Vous pouvez aussi dire « à l'aide »</Text>
        </View>
      )}

      {/* Insistent check-in overlay */}
      {checkinActive && !pending && !pendingPhoto && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.overlay} testID="checkin-overlay">
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>Tout va bien, Mamie ?</Text>
            <Text style={styles.overlaySub}>Appuyez sur le bouton pour dire que tout va bien.</Text>
            <Pressable
              testID="checkin-ok-button"
              onPress={onCheckinOk}
              style={({ pressed }) => [styles.okButton, { opacity: pressed ? 0.9 : 1 }]}
            >
              <Text style={[styles.okLabel, { color: colors.onSuccess }]}>Oui, tout va bien</Text>
            </Pressable>
          </View>
        </Animated.View>
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
              <>
                <Pressable testID="call-now-button" onPress={callEmergency} style={styles.callNow}>
                  <Phone size={22} color={colors.onError} weight="fill" />
                  <Text style={[styles.callNowLabel, { color: colors.onError }]}>Appeler tout de suite</Text>
                </Pressable>
                <Pressable testID="sms-contacts-button" onPress={onSmsContacts} style={styles.smsBtn}>
                  <Text style={[styles.callNowLabel, { color: colors.onBrandPrimary }]}>
                    Prévenir mes proches (SMS)
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </Animated.View>
      )}

      {/* Incoming photo request (camera call) */}
      {pendingPhoto && (
        <PhotoRequestModal
          reqId={pendingPhoto.id}
          onClose={() => setDismissedPhoto((d) => [...d, pendingPhoto.id])}
        />
      )}

      {/* Sound-level monitor (native build only) */}
      <SoundMonitor enabled={soundEnabled} night={isNight} onNoise={onNoise} />
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
  showerBtn: { backgroundColor: colors.info },
  sosBtn: { backgroundColor: colors.error },
  bigLabel: { fontFamily: fonts.display, fontSize: sizes.huge, textAlign: "center" },
  urgent: {
    backgroundColor: colors.error,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: "center",
  },
  urgentTitle: {
    fontFamily: fonts.display,
    fontSize: sizes["2xl"],
    color: colors.onError,
    textAlign: "center",
  },
  urgentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.success,
    minHeight: 72,
    borderRadius: 18,
    width: "100%",
  },
  urgentButtonText: { fontFamily: fonts.display, fontSize: sizes["2xl"] },
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
  smsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.brandPrimary,
    minHeight: 56,
    borderRadius: 20,
    width: "100%",
  },
}));
