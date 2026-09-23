import { View } from "react-native";
import { WebView } from "react-native-webview";

import { makeStyles } from "@/src/theme";

type Props = { lat: number; lng: number; label?: string };

// Native map via Leaflet + OpenStreetMap tiles rendered inside a WebView.
export function LeafletMap({ lat, lng, label = "Mamie" }: Props) {
  const styles = useStyles();
  const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{height:100%;margin:0}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', {zoomControl:true}).setView([${lat}, ${lng}], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'© OpenStreetMap'}).addTo(map);
  L.marker([${lat}, ${lng}]).addTo(map).bindPopup(${JSON.stringify(label)}).openPopup();
</script></body></html>`;

  return (
    <View style={styles.container}>
      <WebView
        testID="leaflet-map-webview"
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.web}
        scrollEnabled={false}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, overflow: "hidden", backgroundColor: colors.surfaceTertiary },
  web: { flex: 1, backgroundColor: colors.surfaceTertiary },
}));
