import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Backspace, CaretLeft, LockKey } from "phosphor-react-native";

import { useConfig } from "@/src/api";
import { fonts, makeStyles, sizes, spacing, useTheme } from "@/src/theme";

export default function Unlock() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: config } = useConfig();

  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const expected = config?.dashboard_pin ?? "1234";

  useEffect(() => {
    if (pin.length < 4) return;
    if (pin === expected) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace("/dashboard");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(true);
      setTimeout(() => {
        setPin("");
        setError(false);
      }, 700);
    }
  }, [pin, expected, router]);

  const press = (d: string) => {
    if (pin.length >= 4) return;
    Haptics.selectionAsync().catch(() => {});
    setPin((p) => p + d);
  };
  const del = () => setPin((p) => p.slice(0, -1));

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }]}>
      <Pressable testID="unlock-back" onPress={() => router.replace("/mamie")} style={styles.back}>
        <CaretLeft size={26} color={colors.onSurface} weight="bold" />
        <Text style={styles.backText}>Retour</Text>
      </Pressable>

      <View style={styles.top}>
        <View style={styles.lockCircle}>
          <LockKey size={40} color={colors.onBrandPrimary} weight="fill" />
        </View>
        <Text style={styles.title}>Espace famille</Text>
        <Text style={styles.subtitle}>Entrez le code (par défaut 1234)</Text>

        <View style={styles.dots}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: error
                    ? colors.error
                    : i < pin.length
                      ? colors.brandPrimary
                      : "transparent",
                  borderColor: error ? colors.error : colors.borderStrong,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.pad}>
        {keys.map((k, i) =>
          k === "" ? (
            <View key={i} style={styles.key} />
          ) : k === "del" ? (
            <Pressable key={i} testID="pin-del" onPress={del} style={styles.key}>
              <Backspace size={30} color={colors.onSurface} weight="bold" />
            </Pressable>
          ) : (
            <Pressable
              key={i}
              testID={`pin-${k}`}
              onPress={() => press(k)}
              style={({ pressed }) => [styles.key, styles.keyFilled, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={styles.keyText}>{k}</Text>
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl },
  back: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm },
  backText: { fontFamily: fonts.textBold, fontSize: sizes.lg, color: colors.onSurface },
  top: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  lockCircle: {
    width: 84,
    height: 84,
    borderRadius: 999,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: fonts.display, fontSize: sizes["2xl"], color: colors.onSurface },
  subtitle: { fontFamily: fonts.text, fontSize: sizes.lg, color: colors.muted },
  dots: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md },
  dot: { width: 22, height: 22, borderRadius: 999, borderWidth: 2 },
  pad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.md },
  key: { width: "30%", aspectRatio: 1.6, alignItems: "center", justifyContent: "center" },
  keyFilled: { backgroundColor: colors.surfaceSecondary, borderRadius: 20 },
  keyText: { fontFamily: fonts.display, fontSize: sizes.huge, color: colors.onSurface },
}));
