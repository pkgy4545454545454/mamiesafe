import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera, Check, X } from "phosphor-react-native";

import { uploadPhoto, useUpdatePhotoRequest } from "@/src/api";
import { fonts, makeStyles, sizes, spacing, useTheme } from "@/src/theme";

type Step = "incoming" | "camera" | "uploading" | "blocked";

export function PhotoRequestModal({ reqId, onClose }: { reqId: string; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const update = useUpdatePhotoRequest();
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>("incoming");
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  }, []);

  const accept = async () => {
    let granted = permission?.granted;
    if (!granted) {
      const res = await requestPermission();
      granted = res.granted;
      if (!granted && res.canAskAgain === false) {
        setStep("blocked");
        return;
      }
      if (!granted) return;
    }
    update.mutate({ id: reqId, status: "accepted" });
    setStep("camera");
  };

  const refuse = () => {
    update.mutate({ id: reqId, status: "refused" });
    onClose();
  };

  const capture = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.5 });
      if (!photo?.uri) return;
      setStep("uploading");
      await uploadPhoto(reqId, photo.uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
    } catch {
      onClose();
    }
  };

  return (
    <View style={[styles.overlay, { paddingTop: insets.top }]} testID="photo-request-modal">
      {step === "incoming" && (
        <View style={styles.incoming}>
          <View style={styles.iconCircle}>
            <Camera size={64} color={colors.onInfo} weight="fill" />
          </View>
          <Text style={styles.title}>Votre famille</Text>
          <Text style={styles.sub}>souhaite une photo pour voir que tout va bien</Text>
          <View style={styles.actionsRow}>
            <Pressable testID="photo-refuse" onPress={refuse} style={[styles.roundBtn, { backgroundColor: colors.error }]}>
              <X size={40} color={colors.onError} weight="bold" />
            </Pressable>
            <Pressable testID="photo-accept" onPress={accept} style={[styles.roundBtn, { backgroundColor: colors.success }]}>
              <Check size={40} color={colors.onSuccess} weight="bold" />
            </Pressable>
          </View>
          <View style={styles.labelsRow}>
            <Text style={styles.actionLabel}>Refuser</Text>
            <Text style={styles.actionLabel}>Accepter</Text>
          </View>
        </View>
      )}

      {step === "camera" && (
        <View style={styles.cameraWrap}>
          <CameraView ref={cameraRef} style={styles.camera} facing="front" />
          <Pressable
            testID="photo-capture"
            onPress={capture}
            style={[styles.captureBtn, { bottom: insets.bottom + spacing.xl }]}
          >
            <View style={styles.captureInner} />
          </Pressable>
        </View>
      )}

      {step === "uploading" && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.onInfo} />
          <Text style={styles.title}>Envoi de la photo…</Text>
        </View>
      )}

      {step === "blocked" && (
        <View style={styles.center}>
          <Text style={styles.title}>Caméra bloquée</Text>
          <Text style={styles.sub}>Autorisez la caméra dans les réglages du téléphone.</Text>
          <Pressable testID="photo-open-settings" onPress={() => Linking.openSettings()} style={styles.settingsBtn}>
            <Text style={styles.settingsText}>Ouvrir les réglages</Text>
          </Pressable>
          <Pressable testID="photo-blocked-close" onPress={refuse} style={styles.closeBtn}>
            <Text style={styles.closeText}>Fermer</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  overlay: {
    ...({ position: "absolute" } as const),
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceInverse,
    zIndex: 10000,
  },
  incoming: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: colors.info,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: { fontFamily: fonts.display, fontSize: sizes.huge, color: colors.onSurfaceInverse, textAlign: "center" },
  sub: { fontFamily: fonts.text, fontSize: sizes.xl, color: colors.onSurfaceInverse, textAlign: "center", opacity: 0.85 },
  actionsRow: { flexDirection: "row", gap: spacing["3xl"], marginTop: spacing.xl },
  labelsRow: { flexDirection: "row", gap: spacing["3xl"], marginTop: spacing.sm },
  actionLabel: { fontFamily: fonts.textBold, fontSize: sizes.lg, color: colors.onSurfaceInverse, width: 88, textAlign: "center" },
  roundBtn: { width: 88, height: 88, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  cameraWrap: { flex: 1 },
  camera: { flex: 1 },
  captureBtn: {
    position: "absolute",
    alignSelf: "center",
    width: 84,
    height: 84,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  captureInner: { width: 64, height: 64, borderRadius: 999, backgroundColor: "#FFFFFF" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  settingsBtn: { backgroundColor: colors.info, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: 16, marginTop: spacing.md },
  settingsText: { fontFamily: fonts.textBold, fontSize: sizes.lg, color: colors.onInfo },
  closeBtn: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  closeText: { fontFamily: fonts.textBold, fontSize: sizes.lg, color: colors.onSurfaceInverse },
}));
