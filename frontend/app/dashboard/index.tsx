import { useRouter } from "expo-router";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bed,
  Bell,
  CheckCircle,
  Ear,
  Pulse,
  WifiHigh,
  WifiSlash,
} from "phosphor-react-native";

import { useSummary } from "@/src/api";
import { DashboardHeader } from "@/src/components/DashboardHeader";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, sizes, spacing, useTheme } from "@/src/theme";
import { fromNow } from "@/src/time";

export default function DashboardStatus() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isRefetching } = useSummary();

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
}));
