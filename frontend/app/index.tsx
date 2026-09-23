import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { STORAGE_KEYS } from "@/src/config";
import { makeStyles, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

export default function Index() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    (async () => {
      const val = await storage.getItem(STORAGE_KEYS.onboarded, false);
      setOnboarded(!!val);
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <View style={styles.center} testID="app-loading">
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  return <Redirect href={onboarded ? "/mamie" : "/onboarding"} />;
}

const useStyles = makeStyles((colors) => ({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
}));
