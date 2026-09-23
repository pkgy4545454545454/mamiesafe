import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as Font from "expo-font";
import { useEffect, useState } from "react";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/Toast";
import { queryClient } from "@/src/query-client";

LogBox.ignoreAllLogs(true);

const FONTS = {
  Figtree: "https://cdn.jsdelivr.net/fontsource/fonts/figtree@latest/latin-700-normal.ttf",
  "Figtree-Semi": "https://cdn.jsdelivr.net/fontsource/fonts/figtree@latest/latin-600-normal.ttf",
  Nunito: "https://cdn.jsdelivr.net/fontsource/fonts/nunito@latest/latin-500-normal.ttf",
  "Nunito-Bold": "https://cdn.jsdelivr.net/fontsource/fonts/nunito@latest/latin-800-normal.ttf",
};

export default function RootLayout() {
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    Font.loadAsync(FONTS)
      .catch(() => {})
      .finally(() => setFontsReady(true));
  }, []);

  // Render regardless once the load attempt finishes; missing fonts fall back
  // to the system font automatically so the app never stays blank.
  if (!fontsReady) {
    // brief window; still mount providers so navigation is ready
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <KeyboardProvider>
              <ToastProvider>
                <Stack screenOptions={{ headerShown: false }} />
              </ToastProvider>
            </KeyboardProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
