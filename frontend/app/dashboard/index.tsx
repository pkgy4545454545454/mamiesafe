import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { RefreshControl, ScrollView, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bed,
  Bell,
  CalendarCheck,
  Camera,
  CheckCircle,
  Ear,
  Pulse,
  WifiHigh,
  WifiSlash,
} from "phosphor-react-native";

import {
  photoUrl,
  useCreatePhotoRequest,
  usePhotoRequests,
  useSummary,
} from "@/src/api";
import { DashboardHeader } from "@/src/components/DashboardHeader";
import { useToast } from "@/src/components/Toast";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, sizes, spacing, useTheme } from "@/src/theme";
import { fromNow } from "@/src/time";

export default function DashboardStatus() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isRefetching } = useSummary();
  const toast = useToast();
  const { data: photoReqs } = usePhotoRequests();
  const requestPhoto = useCreatePhotoRequest();

  const latestPhoto = (photoReqs ?? []).find((p) => p.status === "fulfilled");
  const photoPending = (photoReqs ?? []).some((p) => p.status === "pending" || p.status === "accepted");

  const askPhoto = () => {
    requestPhoto.mutate(undefined, {
      onSuccess: () => toast("Demande envoyée à Mamie 📷", "info"),
      onError: () => toast("Échec de la demande", "error"),
    });
  };

  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const online = data?.status?.online;
  const name = data?.mamie_name ?? "Mamie";
  const pending = data?.pending_alerts ?? 0;

  return (
    <View style={styles.container}>
      <DashboardHeader title={`Bonjour 👋`} subtitle={`Surveillance de ${name}`} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomChrome + spacing.xl, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
      >
        {/* Main status card */}
        <View style={[styles.statusCard, { backgroundColor: online ? colors.brandTertiary : colors.surfaceSecondary }]} testID="status-card">
          <View style={styles.statusRow}>
            {online ? (
              <WifiHigh size={30} color={colors.brandPrimary} weight="fill" />
            ) : (
              <WifiSlash size={30} color={colors.muted} weight="fill" />
            )}
            <Text style={[styles.statusBig, { color: online ? colors.onBrandTertiary : colors.muted }]}>
              {online ? "En ligne" : "Hors ligne"}
            </Text>
          </View>
          <Text style={styles.statusSub}>
            {isLoading ? "Synchronisation…" : online ? "Le téléphone de Mamie veille." : "Aucun signal récent du téléphone."}
          </Text>
        </View>

        {/* Pending alerts banner */}
        {pending > 0 && (
          <View style={styles.alertBanner} testID="pending-alerts-banner">
            <Bell size={24} color={colors.onError} weight="fill" />
            <Text style={styles.alertBannerText}>
              {pending} alerte{pending > 1 ? "s" : ""} à vérifier
            </Text>
            <Text onPress={() => router.push("/dashboard/alerts")} style={styles.alertBannerLink}>
              Voir
            </Text>
          </View>
        )}

        {/* Vitals grid */}
        <View style={styles.grid}>
          <View style={styles.tile}>
            <CheckCircle size={28} color={colors.success} weight="fill" />
            <Text style={styles.tileLabel}>Dernier check-in</Text>
            <Text style={styles.tileValue}>{fromNow(data?.last_checkin)}</Text>
          </View>
          <View style={styles.tile}>
            <Bed size={28} color={colors.brandPrimary} weight="fill" />
            <Text style={styles.tileLabel}>Couchée</Text>
            <Text style={styles.tileValue}>{fromNow(data?.last_bedtime)}</Text>
          </View>
          <View style={styles.tile}>
            <Pulse size={28} color={data?.status?.fall_active ? colors.success : colors.muted} weight="fill" />
            <Text style={styles.tileLabel}>Détection de chute</Text>
            <Text style={styles.tileValue}>{data?.status?.fall_active ? "Active" : "Inactive"}</Text>
          </View>
          <View style={styles.tile}>
            <Ear size={28} color={data?.status?.listening ? colors.success : colors.muted} weight="fill" />
            <Text style={styles.tileLabel}>Écoute vocale</Text>
            <Text style={styles.tileValue}>{data?.status?.listening ? "Active" : "Inactive"}</Text>
          </View>
        </View>

        <Pressable
          testID="open-activities"
          onPress={() => router.push("/activities")}
          style={({ pressed }) => [styles.navCard, { opacity: pressed ? 0.9 : 1 }]}
        >
          <CalendarCheck size={30} color={colors.onBrandPrimary} weight="fill" />
          <View style={{ flex: 1 }}>
            <Text style={styles.navTitle}>Activités & sorties</Text>
            <Text style={styles.navSub}>Programmez piscine, marché… avec confirmation de Mamie</Text>
          </View>
        </Pressable>

        {/* Photo de contrôle */}
        <View style={styles.photoCard} testID="photo-card">
          <View style={styles.photoHeader}>
            <Text style={styles.photoTitle}>Photo de contrôle</Text>
            <Pressable testID="request-photo" onPress={askPhoto} style={styles.photoBtn}>
              <Camera size={20} color={colors.onBrandPrimary} weight="fill" />
              <Text style={styles.photoBtnText}>Demander</Text>
            </Pressable>
          </View>
          {photoPending ? (
            <Text style={styles.photoHint}>En attente que Mamie prenne la photo…</Text>
          ) : latestPhoto ? (
            <Image
              testID="latest-photo"
              source={photoUrl(latestPhoto.id)}
              style={styles.photo}
              contentFit="cover"
              transition={300}
            />
          ) : (
            <Text style={styles.photoHint}>Aucune photo pour l'instant. Appuyez sur « Demander ».</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  statusCard: { borderRadius: 20, padding: spacing.lg, gap: spacing.xs },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  statusBig: { fontFamily: fonts.display, fontSize: sizes["2xl"] },
  statusSub: { fontFamily: fonts.text, fontSize: sizes.lg, color: colors.muted },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.error,
    borderRadius: 16,
    padding: spacing.md,
  },
  alertBannerText: { flex: 1, fontFamily: fonts.textBold, fontSize: sizes.lg, color: colors.onError },
  alertBannerLink: { fontFamily: fonts.textBold, fontSize: sizes.lg, color: colors.onError, textDecorationLine: "underline" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  tile: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  tileLabel: { fontFamily: fonts.text, fontSize: sizes.base, color: colors.muted, marginTop: spacing.xs },
  tileValue: { fontFamily: fonts.textBold, fontSize: sizes.lg, color: colors.onSurface },
  navCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.brandPrimary,
    borderRadius: 20,
    padding: spacing.lg,
  },
  navTitle: { fontFamily: fonts.displaySemi, fontSize: sizes.xl, color: colors.onBrandPrimary },
  navSub: { fontFamily: fonts.text, fontSize: sizes.base, color: colors.onBrandPrimary, opacity: 0.85 },
  photoCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 20, padding: spacing.lg, gap: spacing.md },
  photoHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  photoTitle: { fontFamily: fonts.displaySemi, fontSize: sizes.xl, color: colors.onSurface },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
  },
  photoBtnText: { fontFamily: fonts.textBold, fontSize: sizes.base, color: colors.onBrandPrimary },
  photoHint: { fontFamily: fonts.text, fontSize: sizes.lg, color: colors.muted },
  photo: { width: "100%", height: 260, borderRadius: 16, backgroundColor: colors.surfaceTertiary },
}));
