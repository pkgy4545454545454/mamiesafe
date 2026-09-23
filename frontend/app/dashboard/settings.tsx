import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FloppyDisk, Plus, SignOut, Trash, UserPlus } from "phosphor-react-native";

import { Contact, useConfig, useUpdateConfig } from "@/src/api";
import { DashboardHeader } from "@/src/components/DashboardHeader";
import { useToast } from "@/src/components/Toast";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, sizes, spacing, useTheme } from "@/src/theme";

const SENSITIVITY = [
  { key: "basse", label: "Basse" },
  { key: "moyenne", label: "Moyenne" },
  { key: "haute", label: "Haute" },
] as const;

const INTERVALS = [2, 4, 6, 8];

export default function SettingsContacts() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { data: config } = useConfig();
  const update = useUpdateConfig();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const [name, setName] = useState("");
  const [emergency, setEmergency] = useState("");
  const [sensitivity, setSensitivity] = useState<(typeof SENSITIVITY)[number]["key"]>("moyenne");
  const [interval, setInterval] = useState(4);
  const [pin, setPin] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  useEffect(() => {
    if (!config) return;
    setName(config.mamie_name);
    setEmergency(config.emergency_number);
    setSensitivity(config.fall_sensitivity);
    setInterval(config.checkin_interval_hours);
    setPin(config.dashboard_pin);
    setContacts(config.contacts ?? []);
  }, [config]);

  const addContact = () => {
    if (!newName.trim() || !newPhone.trim()) {
      toast("Nom et téléphone requis", "error");
      return;
    }
    setContacts((c) => [...c, { name: newName.trim(), phone: newPhone.trim(), primary: c.length === 0 }]);
    setNewName("");
    setNewPhone("");
  };

  const removeContact = (i: number) => setContacts((c) => c.filter((_, idx) => idx !== i));

  const save = () => {
    update.mutate(
      {
        mamie_name: name.trim() || "Mamie",
        emergency_number: emergency.trim() || "112",
        fall_sensitivity: sensitivity,
        checkin_interval_hours: interval,
        dashboard_pin: pin.trim() || "1234",
        contacts,
      },
      {
        onSuccess: () => toast("Réglages enregistrés ✓", "success"),
        onError: () => toast("Échec de l'enregistrement", "error"),
      },
    );
  };

  return (
    <View style={styles.container}>
      <DashboardHeader
        title="Réglages"
        subtitle="Contacts et sécurité"
        right={
          <Pressable testID="settings-save-top" onPress={save} style={styles.saveTop}>
            <FloppyDisk size={20} color={colors.onBrandPrimary} weight="fill" />
            <Text style={styles.saveTopText}>Enregistrer</Text>
          </Pressable>
        }
      />
      <KeyboardAwareScrollView
        bottomOffset={20}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomChrome + spacing["3xl"], gap: spacing.lg }}
      >
        {/* Basics */}
        <View style={styles.field}>
          <Text style={styles.label}>Nom affiché</Text>
          <TextInput
            testID="input-name"
            value={name}
            onChangeText={setName}
            placeholder="Mamie"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Numéro d'urgence</Text>
          <TextInput
            testID="input-emergency"
            value={emergency}
            onChangeText={setEmergency}
            keyboardType="phone-pad"
            placeholder="112"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>

        {/* Sensitivity */}
        <View style={styles.field}>
          <Text style={styles.label}>Sensibilité détection de chute</Text>
          <View style={styles.segment}>
            {SENSITIVITY.map((s) => {
              const active = sensitivity === s.key;
              return (
                <Pressable
                  key={s.key}
                  testID={`sensitivity-${s.key}`}
                  onPress={() => setSensitivity(s.key)}
                  style={[styles.segItem, { backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary }]}
                >
                  <Text style={[styles.segText, { color: active ? colors.onBrandPrimary : colors.onSurface }]}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>« Basse » = moins d'alertes inutiles.</Text>
        </View>

        {/* Check-in interval */}
        <View style={styles.field}>
          <Text style={styles.label}>Rappel « Tout va bien ? » toutes les</Text>
          <View style={styles.segment}>
            {INTERVALS.map((h) => {
              const active = interval === h;
              return (
                <Pressable
                  key={h}
                  testID={`interval-${h}`}
                  onPress={() => setInterval(h)}
                  style={[styles.segItem, { backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary }]}
                >
                  <Text style={[styles.segText, { color: active ? colors.onBrandPrimary : colors.onSurface }]}>
                    {h}h
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* PIN */}
        <View style={styles.field}>
          <Text style={styles.label}>Code d'accès famille (4 chiffres)</Text>
          <TextInput
            testID="input-pin"
            value={pin}
            onChangeText={(t) => setPin(t.replace(/[^0-9]/g, "").slice(0, 4))}
            keyboardType="number-pad"
            placeholder="1234"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>

        {/* Contacts */}
        <View style={styles.field}>
          <Text style={styles.label}>Contacts d'urgence</Text>
          {contacts.map((c, i) => (
            <View key={`${c.phone}-${i}`} style={styles.contactRow} testID={`contact-${i}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>
                  {c.name} {c.primary ? "⭐" : ""}
                </Text>
                <Text style={styles.contactPhone}>{c.phone}</Text>
              </View>
              <Pressable testID={`contact-remove-${i}`} onPress={() => removeContact(i)} style={styles.trashBtn}>
                <Trash size={20} color={colors.onError} weight="fill" />
              </Pressable>
            </View>
          ))}

          <View style={styles.addBox}>
            <TextInput
              testID="input-contact-name"
              value={newName}
              onChangeText={setNewName}
              placeholder="Nom (ex: Voisine)"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <TextInput
              testID="input-contact-phone"
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
              placeholder="Téléphone"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <Pressable testID="contact-add" onPress={addContact} style={styles.addBtn}>
              <UserPlus size={20} color={colors.onBrandPrimary} weight="fill" />
              <Text style={styles.addBtnText}>Ajouter le contact</Text>
            </Pressable>
          </View>
        </View>

        <Pressable testID="settings-save" onPress={save} style={styles.saveBtn}>
          <Plus size={22} color={colors.onBrandPrimary} weight="bold" style={{ opacity: 0 }} />
          <Text style={styles.saveBtnText}>Enregistrer les réglages</Text>
        </Pressable>

        <Pressable testID="switch-to-mamie" onPress={() => router.replace("/mamie")} style={styles.mamieBtn}>
          <SignOut size={20} color={colors.onSurface} weight="bold" />
          <Text style={styles.mamieBtnText}>Repasser en mode Mamie</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  saveTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
  },
  saveTopText: { fontFamily: fonts.textBold, fontSize: sizes.base, color: colors.onBrandPrimary },
  field: { gap: spacing.sm },
  label: { fontFamily: fonts.textBold, fontSize: sizes.lg, color: colors.onSurface },
  hint: { fontFamily: fonts.text, fontSize: sizes.base, color: colors.muted },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.text,
    fontSize: sizes.xl,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: { flexDirection: "row", gap: spacing.sm },
  segItem: { flex: 1, paddingVertical: spacing.md, borderRadius: 14, alignItems: "center" },
  segText: { fontFamily: fonts.textBold, fontSize: sizes.lg },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.md,
  },
  contactName: { fontFamily: fonts.displaySemi, fontSize: sizes.lg, color: colors.onSurface },
  contactPhone: { fontFamily: fonts.text, fontSize: sizes.base, color: colors.muted },
  trashBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  addBox: { gap: spacing.sm, marginTop: spacing.xs },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.brandPrimary,
    paddingVertical: spacing.md,
    borderRadius: 14,
  },
  addBtnText: { fontFamily: fonts.textBold, fontSize: sizes.lg, color: colors.onBrandPrimary },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.brandPrimary,
    minHeight: 60,
    borderRadius: 18,
    marginTop: spacing.sm,
  },
  saveBtnText: { fontFamily: fonts.display, fontSize: sizes.xl, color: colors.onBrandPrimary },
  mamieBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    minHeight: 56,
    borderRadius: 18,
  },
  mamieBtnText: { fontFamily: fonts.textBold, fontSize: sizes.lg, color: colors.onSurface },
}));
