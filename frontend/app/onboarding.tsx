import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bed, HandHeart, Moon, ShieldCheck, Warning } from "phosphor-react-native";

import { STORAGE_KEYS } from "@/src/config";
import {
  registerForPush,
  requestNotificationPermissions,
  scheduleBedtimeReminder,
  scheduleCheckinReminders,
} from "@/src/notifications";
import { fonts, makeStyles, sizes, spacing, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

const HERO = "https://images.pexels.com/photos/5257621/pexels-photo-5257621.jpeg";

export default function Onboarding() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  const finish = async () => {
    await storage.setItem(STORAGE_KEYS.onboarded, true);
    if (Platform.OS !== "web") {
      await requestNotificationPermissions();
      await scheduleCheckinReminders(4);
      await scheduleBedtimeReminder();
      registerForPush("mamie").catch(() => {});
    }
    router.replace("/mamie");
  };

  const next = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (step >= steps.length - 1) finish();
    else setStep((s) => s + 1);
  };

  const steps = [
    {
      key: "welcome",
      hero: true,
      icon: <HandHeart size={72} color={colors.onBrandPrimary} weight="fill" />,
      title: "Bienvenue 💛",
      body: "Cette application veille sur vous. C'est très simple : deux gros boutons, c'est tout.",
      cta: "Commencer",
      ctaColor: colors.brandPrimary,
      ctaText: colors.onBrandPrimary,
    },
    {
      key: "bed",
      icon: <Moon size={90} color={colors.onSuccess} weight="fill" />,
      title: "Le bouton « Je me couche »",
      body: "Chaque soir avant de dormir, appuyez sur le bouton vert. Essayons maintenant : appuyez !",
      cta: "🌙 Je me couche",
      ctaColor: colors.success,
      ctaText: colors.onSuccess,
    },
    {
      key: "sos",
      icon: <Warning size={90} color={colors.onError} weight="fill" />,
      title: "Le bouton rouge « SOS »",
      body: "Si vous tombez ou avez besoin d'aide, appuyez sur le bouton rouge. Il prévient votre famille et appelle les secours. Essayez (c'est un test) !",
      cta: "🆘 J'ai besoin d'aide",
      ctaColor: colors.error,
      ctaText: colors.onError,
    },
    {
      key: "auto",
      icon: <ShieldCheck size={90} color={colors.onBrandPrimary} weight="fill" />,
      title: "Gardez votre téléphone sur vous",
      body: "Le téléphone veille tout seul : il détecte une chute et prévient votre famille, même si vous ne touchez à rien.",
      cta: "J'ai compris",
      ctaColor: colors.brandPrimary,
      ctaText: colors.onBrandPrimary,
    },
    {
      key: "done",
      icon: <Bed size={90} color={colors.onBrandPrimary} weight="fill" />,
      title: "C'est prêt !",
      body: "Vous n'avez rien d'autre à faire. Les deux gros boutons sont toujours là pour vous.",
      cta: "Terminer",
      ctaColor: colors.brandPrimary,
      ctaText: colors.onBrandPrimary,
    },
  ];

  const cur = steps[step];

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.progressRow}>
        {steps.map((s, i) => (
          <View
            key={s.key}
            style={[styles.dot, { backgroundColor: i <= step ? colors.brandPrimary : colors.border }]}
          />
        ))}
      </View>

      <Animated.View key={cur.key} entering={FadeIn.duration(350)} style={styles.body}>
        {cur.hero ? (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.heroWrap}>
            <Image source={HERO} style={styles.hero} contentFit="cover" transition={300} />
          </Animated.View>
        ) : (
          <View style={[styles.iconCircle, { backgroundColor: cur.ctaColor }]}>{cur.icon}</View>
        )}

        <Text style={styles.title} testID="onboarding-title">
          {cur.title}
        </Text>
        <Text style={styles.text}>{cur.body}</Text>
      </Animated.View>

      <Pressable
        testID="onboarding-next-button"
        onPress={next}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: cur.ctaColor, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.ctaLabel, { color: cur.ctaText }]}>{cur.cta}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
  },
  progressRow: { flexDirection: "row", gap: spacing.sm, justifyContent: "center", marginBottom: spacing.lg },
  dot: { width: 28, height: 8, borderRadius: 999 },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg },
  heroWrap: { width: "100%", height: 240, borderRadius: 24, overflow: "hidden", marginBottom: spacing.md },
  hero: { width: "100%", height: "100%" },
  iconCircle: {
    width: 150,
    height: 150,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: sizes.huge,
    color: colors.onSurface,
    textAlign: "center",
    lineHeight: sizes.huge + 6,
  },
  text: {
    fontFamily: fonts.text,
    fontSize: sizes.xl,
    color: colors.muted,
    textAlign: "center",
    lineHeight: sizes.xl + 10,
  },
  cta: {
    minHeight: 88,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  ctaLabel: { fontFamily: fonts.display, fontSize: sizes["2xl"], textAlign: "center" },
}));
