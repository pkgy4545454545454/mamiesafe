import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle, Info, WarningCircle } from "phosphor-react-native";

import { fonts, makeStyles, sizes, spacing, useTheme } from "@/src/theme";

type ToastVariant = "success" | "info" | "error";
type ToastState = { message: string; variant: ToastVariant } | null;

const ToastContext = createContext<(message: string, variant?: ToastVariant) => void>(
  () => {},
);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, variant: ToastVariant = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, variant });
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const bg =
    toast?.variant === "error"
      ? colors.error
      : toast?.variant === "info"
        ? colors.info
        : colors.success;
  const fg =
    toast?.variant === "error"
      ? colors.onError
      : toast?.variant === "info"
        ? colors.onInfo
        : colors.onSuccess;

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          entering={FadeInUp}
          exiting={FadeOutUp}
          pointerEvents="box-none"
          style={[styles.wrap, { top: insets.top + spacing.sm }]}
        >
          <Pressable
            testID="app-toast"
            onPress={() => setToast(null)}
            style={[styles.toast, { backgroundColor: bg }]}
          >
            {toast.variant === "error" ? (
              <WarningCircle size={22} color={fg} weight="fill" />
            ) : toast.variant === "info" ? (
              <Info size={22} color={fg} weight="fill" />
            ) : (
              <CheckCircle size={22} color={fg} weight="fill" />
            )}
            <Text style={[styles.text, { color: fg }]}>{toast.message}</Text>
          </Pressable>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const useStyles = makeStyles(() => ({
  wrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 16,
    maxWidth: 520,
    width: "100%",
  },
  text: { flex: 1, fontFamily: fonts.textBold, fontSize: sizes.lg },
}));
