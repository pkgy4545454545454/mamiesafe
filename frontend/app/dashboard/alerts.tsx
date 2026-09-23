import { Image } from "expo-image";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, X } from "phosphor-react-native";

import { Alert, Severity, useAlerts, useResolveAlert } from "@/src/api";
import { DashboardHeader } from "@/src/components/DashboardHeader";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, sizes, spacing, useTheme } from "@/src/theme";
import { formatTime } from "@/src/time";

const EMPTY = "https://images.pexels.com/photos/27921847/pexels-photo-27921847.jpeg";

const KIND_LABEL: Record<string, string> = {
  fall: "Chute possible",
  sos: "SOS",
  noise: "Bruit suspect",
  missed_checkin: "Check-in manqué",
  voice: "Appel à l'aide vocal",
};

function useSeverity() {
  const { colors } = useTheme();
  return (s: Severity): { color: string; label: string } => {
    if (s === "dangereux") return { color: colors.error, label: "Dangereux" };
    if (s === "moyen") return { color: colors.brandSecondary, label: "Moyen" };
    return { color: colors.warning, label: "Léger" };
  };
}

export default function AlertHistory() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const sev = useSeverity();
  const { data: alerts, isLoading } = useAlerts();
  const resolve = useResolveAlert();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const renderItem = ({ item }: { item: Alert }) => {
    const s = sev(item.severity);
    return (
      <View style={styles.row} testID={`alert-row-${item.id}`}>
        <View style={[styles.severityBar, { backgroundColor: s.color }]} />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.kind}>{KIND_LABEL[item.kind] ?? item.kind}</Text>
            <View style={[styles.badge, { backgroundColor: s.color }]}>
              <Text style={styles.badgeText}>{s.label}</Text>
            </View>
          </View>
          {!!item.message && <Text style={styles.message}>{item.message}</Text>}
          <Text style={styles.time}>{formatTime(item.created_at)}</Text>

          {item.status === "pending" ? (
            <View style={styles.actions}>
              <Pressable
                testID={`alert-validate-${item.id}`}
                onPress={() => resolve.mutate({ id: item.id, status: "validated" })}
                style={[styles.actionBtn, { backgroundColor: colors.success }]}
              >
                <Check size={18} color={colors.onSuccess} weight="bold" />
                <Text style={[styles.actionText, { color: colors.onSuccess }]}>Vérifié</Text>
              </Pressable>
              <Pressable
                testID={`alert-dismiss-${item.id}`}
                onPress={() => resolve.mutate({ id: item.id, status: "dismissed" })}
                style={[styles.actionBtn, { backgroundColor: colors.surfaceTertiary }]}
              >
                <X size={18} color={colors.onSurface} weight="bold" />
                <Text style={[styles.actionText, { color: colors.onSurface }]}>Fausse alerte</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={[styles.resolved, { color: item.status === "validated" ? colors.success : colors.muted }]}>
              {item.status === "validated" ? "✓ Vérifiée" : "Ignorée (fausse alerte)"}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <DashboardHeader title="Alertes" subtitle="Historique et sévérité" />
      <FlatList
        data={alerts ?? []}
        keyExtractor={(a) => a.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomChrome + spacing.xl, gap: spacing.md, flexGrow: 1 }}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty} testID="alerts-empty">
              <Image source={EMPTY} style={styles.emptyImg} contentFit="cover" transition={300} />
              <Text style={styles.emptyTitle}>Aucune alerte récente</Text>
              <Text style={styles.emptyText}>Tout va bien. Les alertes apparaîtront ici.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  row: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 18,
    overflow: "hidden",
  },
  severityBar: { width: 8 },
  rowBody: { flex: 1, padding: spacing.md, gap: spacing.xs },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kind: { fontFamily: fonts.displaySemi, fontSize: sizes.xl, color: colors.onSurface },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontFamily: fonts.textBold, fontSize: sizes.sm, color: "#FFFFFF" },
  message: { fontFamily: fonts.text, fontSize: sizes.lg, color: colors.onSurfaceSecondary },
  time: { fontFamily: fonts.text, fontSize: sizes.base, color: colors.muted },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
  },
  actionText: { fontFamily: fonts.textBold, fontSize: sizes.base },
  resolved: { fontFamily: fonts.textBold, fontSize: sizes.base, marginTop: spacing.xs },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingTop: spacing["3xl"] },
  emptyImg: { width: 180, height: 180, borderRadius: 24 },
  emptyTitle: { fontFamily: fonts.display, fontSize: sizes["2xl"], color: colors.onSurface },
  emptyText: { fontFamily: fonts.text, fontSize: sizes.lg, color: colors.muted, textAlign: "center" },
}));
