import { Platform } from "react-native";

// iOS 26+ gets native liquid-glass tabs; everyone else uses the classic JS bar.
export const usesNativeTabs =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;
