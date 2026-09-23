import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowClockwise, MapPin } from "phosphor-react-native";

import { useLatestLocation } from "@/src/api";
import { DashboardHeader } from "@/src/components/DashboardHeader";
import { LeafletMap } from "@/src/components/LeafletMap";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, sizes, spacing, useTheme } from "@/src/theme";
import { fromNow } from "@/src/time";

export default function LiveMap() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isRefetching } = useLatestLocation();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const hasLoc = data && data.lat != null && data.lng != null;

  return (
    <View style={styles.container}>
      <DashboardHeader
        title="Position"
        subtitle="Dernière localisation connue"
        right={
          <Pressable testID="map-refresh" onPress={() => refetch()} style={styles.refreshBtn}>
            <ArrowClockwise size={22} color={colors.onBrandPrimary} weight="bold" />
          </Pressable>
        }
      />

      <View style={styles.mapArea}>
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.brandPrimary} />
          </View>
        ) : hasLoc ? (
          <LeafletMap lat={data!.lat as number} lng={data!.lng as number} label="Mamie" />
        ) : (
          <View style={styles.center} testID="map-empty">
            <MapPin size={64} color={colors.muted} weight="fill" />
            <Text style={styles.emptyTitle}>Position indisponible</Text>
            <Text style={styles.emptyText}>
              La position s'affichera dès que Mamie aura autorisé la localisation sur son téléphone.
            </Text>
          </View>
        )}

        {hasLoc && (
          <View style={[styles.infoCard, { bottom: bottomChrome + spacing.lg }]} testID="map-info-card">
            <MapPin size={26} color={colors.brandPrimary} weight="fill" />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Mamie</Text>
              <Text style={styles.infoSub}>
                Mis à jour {fromNow(data!.created_at)}
                {data!.accuracy ? ` · ±${Math.round(data!.accuracy)} m` : ""}
              </Text>
            </View>
            <Pressable
              testID="map-info-refresh"
              onPress={() => refetch()}
              style={styles.updateBtn}
            >
              {isRefetching ? (
                <ActivityIndicator size="small" color={colors.onBrandPrimary} />
              ) : (
                <Text style={styles.updateText}>Actualiser</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  mapArea: { flex: 1, position: "relative" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  emptyTitle: { fontFamily: fonts.display, fontSize: sizes["2xl"], color: colors.onSurface },
  emptyText: { fontFamily: fonts.text, fontSize: sizes.lg, color: colors.muted, textAlign: "center" },
  infoCard: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  infoTitle: { fontFamily: fonts.displaySemi, fontSize: sizes.xl, color: colors.onSurface },
  infoSub: { fontFamily: fonts.text, fontSize: sizes.base, color: colors.muted },
  updateBtn: {
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    minWidth: 92,
    alignItems: "center",
  },
  updateText: { fontFamily: fonts.textBold, fontSize: sizes.base, color: colors.onBrandPrimary },
}));
