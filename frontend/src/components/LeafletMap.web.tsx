import React from "react";
import { View } from "react-native";

import { makeStyles } from "@/src/theme";

type Props = { lat: number; lng: number; label?: string };

// Web map: OpenStreetMap embed with a marker (rendered as a real <iframe>).
export function LeafletMap({ lat, lng }: Props) {
  const styles = useStyles();
  const d = 0.008;
  const bbox = `${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;

  return (
    <View style={styles.container} testID="leaflet-map-web">
      {React.createElement("iframe", {
        src,
        style: { border: 0, width: "100%", height: "100%" },
        title: "map",
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, overflow: "hidden", backgroundColor: colors.surfaceTertiary },
}));
