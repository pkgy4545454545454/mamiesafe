import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarPlus, CaretLeft, Trash } from "phosphor-react-native";

import { Activity, useActivities, useConfirmActivity, useCreateActivity } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { fonts, makeStyles, sizes, spacing, useTheme } from "@/src/theme";
import { formatTime } from "@/src/time";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Prévue",
  awaiting_confirmation: "En attente ✋",
  confirmed: "Terminée ✅",
  escalated: "Alerte 🚨",
  cancelled: "Annulée",
};

function todayStr() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function Activities() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const { data: activities } = useActivities();
  const createActivity = useCreateActivity();
  const confirm = useConfirmActivity();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayStr());
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("12:00");
  const [grace, setGrace] = useState("10");

  const add = () => {
    if (!title.trim()) {
      toast("Donnez un nom à l'activité", "error");
      return;
    }
    const startDate = new Date(`${date}T${start}:00`);
    const endDate = new Date(`${date}T${end}:00`);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      toast("Date ou heure invalide (JJ format AAAA-MM-JJ, HH:MM)", "error");
      return;
    }
    if (endDate <= startDate) {
      toast("L'heure de fin doit être après le début", "error");
      return;
    }
    createActivity.mutate(
      {
        title: title.trim(),
        kind: "activity",
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        grace_minutes: parseInt(grace, 10) || 10,
      },
      {
        onSuccess: () => {
          toast("Activité ajoutée 📅", "success");
          setTitle("");
        },
        onError: () => toast("Échec de l'ajout", "error"),
      },
    );
  };

  const active = (activities ?? []).filter((a) => a.status !== "cancelled");

  const renderRow = (a: Activity) => (
    <View key={a.id} style={styles.row} testID={`activity-row-${a.id}`}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{a.title}</Text>
        <Text style={styles.rowTime}>
          {formatTime(a.start_at)} → {formatTime(a.end_at)}
        </Text>
        <Text
          style={[
            styles.status,
            {
              color:
                a.status === "escalated"
                  ? colors.error
                  : a.status === "confirmed"
                    ? colors.success
                    : a.status === "awaiting_confirmation"
                      ? colors.warning
                      : colors.muted,
            },
          ]}
        >
          {STATUS_LABEL[a.status] ?? a.status}
        </Text>
      </View>
      {(a.status === "scheduled" || a.status === "awaiting_confirmation") && (
        <Pressable
          testID={`activity-cancel-${a.id}`}
          onPress={() => confirm.mutate({ id: a.id, status: "cancelled" })}
          style={styles.trashBtn}
        >
          <Trash size={20} color={colors.onError} weight="fill" />
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="activities-back" onPress={() => router.replace("/dashboard")} style={styles.back}>
          <CaretLeft size={26} color={colors.onSurface} weight="bold" />
        </Pressable>
        <Text style={styles.headerTitle}>Activités & sorties</Text>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={20}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["3xl"], gap: spacing.lg }}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nouvelle activité</Text>
          <Text style={styles.hint}>
            À la fin, Mamie recevra « Avez-vous fini ? ». Sans réponse après le délai, vous serez alerté.
          </Text>

          <TextInput
            testID="activity-title"
            value={title}
            onChangeText={setTitle}
            placeholder="Ex : Piscine, Marché, Coiffeur…"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <TextInput
            testID="activity-date"
            value={date}
            onChangeText={setDate}
            placeholder="AAAA-MM-JJ"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <View style={styles.rowInputs}>
            <View style={{ flex: 1 }}>
              <Text style={styles.smallLabel}>Début</Text>
              <TextInput
                testID="activity-start"
                value={start}
                onChangeText={setStart}
                placeholder="09:00"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.smallLabel}>Fin</Text>
              <TextInput
                testID="activity-end"
                value={end}
                onChangeText={setEnd}
                placeholder="12:00"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>
            <View style={{ width: 90 }}>
              <Text style={styles.smallLabel}>Délai (min)</Text>
              <TextInput
                testID="activity-grace"
                value={grace}
                onChangeText={(t) => setGrace(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder="10"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>
          </View>

          <Pressable testID="activity-add" onPress={add} style={styles.addBtn}>
            <CalendarPlus size={22} color={colors.onBrandPrimary} weight="fill" />
            <Text style={styles.addBtnText}>Ajouter l'activité</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Activités programmées</Text>
        {active.length === 0 ? (
          <Text style={styles.empty} testID="activities-empty">
            Aucune activité pour l'instant.
          </Text>
        ) : (
          active.map(renderRow)
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  back: { paddingRight: spacing.xs },
  headerTitle: { fontFamily: fonts.display, fontSize: sizes["2xl"], color: colors.onSurface },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: 20, padding: spacing.lg, gap: spacing.sm },
  cardTitle: { fontFamily: fonts.displaySemi, fontSize: sizes.xl, color: colors.onSurface },
  hint: { fontFamily: fonts.text, fontSize: sizes.base, color: colors.muted },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.text,
    fontSize: sizes.lg,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowInputs: { flexDirection: "row", gap: spacing.sm },
  smallLabel: { fontFamily: fonts.text, fontSize: sizes.sm, color: colors.muted, marginBottom: 4 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.brandPrimary,
    paddingVertical: spacing.md,
    borderRadius: 14,
    marginTop: spacing.xs,
  },
  addBtnText: { fontFamily: fonts.textBold, fontSize: sizes.lg, color: colors.onBrandPrimary },
  sectionTitle: { fontFamily: fonts.displaySemi, fontSize: sizes.xl, color: colors.onSurface },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    padding: spacing.md,
  },
  rowTitle: { fontFamily: fonts.displaySemi, fontSize: sizes.lg, color: colors.onSurface },
  rowTime: { fontFamily: fonts.text, fontSize: sizes.base, color: colors.muted },
  status: { fontFamily: fonts.textBold, fontSize: sizes.base, marginTop: 2 },
  trashBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { fontFamily: fonts.text, fontSize: sizes.lg, color: colors.muted },
}));
