// Design tokens for MamieSafe. Light + dark. Keys mirror the "color" block of
// /app/design_guidelines.json. Build sheets with makeStyles(); read colors from
// useTheme().colors for non-style color props. Never write color literals in
// components (except brand-fixed colors that must stay identical in both modes).

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFBF7",
  onSurface: "#1C1917",
  surfaceSecondary: "#F5F0E6",
  onSurfaceSecondary: "#1C1917",
  surfaceTertiary: "#EAE4D9",
  onSurfaceTertiary: "#1C1917",
  surfaceInverse: "#1C1917",
  onSurfaceInverse: "#FFFBF7",
  muted: "#57534E",

  brand: "#0F766E",
  onBrand: "#FFFFFF",
  brandPrimary: "#0F766E",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#F59E0B",
  onBrandSecondary: "#1C1917",
  brandTertiary: "#CCFBF1",
  onBrandTertiary: "#0F766E",

  success: "#10B981",
  onSuccess: "#FFFFFF",
  warning: "#F59E0B",
  onWarning: "#1C1917",
  error: "#DC2626",
  onError: "#FFFFFF",
  info: "#2563EB",
  onInfo: "#FFFFFF",

  border: "#E5E7EB",
  borderStrong: "#1C1917",
  divider: "#E5E7EB",
};

const dark: typeof light = {
  surface: "#1A1714",
  onSurface: "#F5F0E6",
  surfaceSecondary: "#26221E",
  onSurfaceSecondary: "#F5F0E6",
  surfaceTertiary: "#332E28",
  onSurfaceTertiary: "#F5F0E6",
  surfaceInverse: "#F5F0E6",
  onSurfaceInverse: "#1A1714",
  muted: "#A8A29E",

  brand: "#2DD4BF",
  onBrand: "#08302C",
  brandPrimary: "#2DD4BF",
  onBrandPrimary: "#08302C",
  brandSecondary: "#FBBF24",
  onBrandSecondary: "#1A1714",
  brandTertiary: "#134E4A",
  onBrandTertiary: "#CCFBF1",

  success: "#34D399",
  onSuccess: "#08302C",
  warning: "#FBBF24",
  onWarning: "#1A1714",
  error: "#F87171",
  onError: "#3B0A0A",
  info: "#60A5FA",
  onInfo: "#08213B",

  border: "#403A33",
  borderStrong: "#F5F0E6",
  divider: "#403A33",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light, dark };

// Senior-friendly typography. Mamie mode uses the big end of the scale.
export const fonts = {
  display: "Figtree",
  displaySemi: "Figtree-Semi",
  text: "Nunito",
  textBold: "Nunito-Bold",
};

export const sizes = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
  // senior / giant scale
  huge: 34,
  giant: 44,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
