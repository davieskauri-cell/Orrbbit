import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import MapBackground from "@/src/components/MapBackground";

const TILE = 256;

function tileXY(lat: number, lng: number, z: number) {
  const n = Math.pow(2, z);
  const x = ((lng + 180) / 360) * n;
  const latR = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n;
  return { x, y };
}

type Props = { lat: number; lng: number; width: number; height: number; zoom?: number; showFallback?: boolean };

/**
 * Bright bird's-eye basemap (CARTO Voyager / OpenStreetMap) centred on the
 * user's actual location. Colourful premium style — buildings, parks, water.
 * Renders retina (@2x) raster tiles as plain images — works on web + native.
 * Only the CURRENT user's location is used; other users are never placed at
 * real coordinates on this map.
 */
export default function MapTiles({ lat, lng, width, height, zoom = 17, showFallback = true }: Props) {
  const z = Math.min(zoom, 20); // CARTO voyager max zoom
  const { x, y } = tileXY(lat, lng, z);
  const cx = width / 2;
  const cy = height / 2;
  const x0 = Math.floor(x - cx / TILE);
  const x1 = Math.floor(x + cx / TILE);
  const y0 = Math.floor(y - cy / TILE);
  const y1 = Math.floor(y + cy / TILE);

  const tiles = [];
  for (let tx = x0; tx <= x1; tx++) {
    for (let ty = y0; ty <= y1; ty++) {
      tiles.push(
        <Image
          key={`${tx}-${ty}`}
          source={{ uri: `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${tx}/${ty}@2x.png` }}
          style={{ position: "absolute", left: cx + (tx - x) * TILE, top: cy + (ty - y) * TILE, width: TILE, height: TILE }}
          contentFit="cover"
          transition={200}
        />
      );
    }
  }

  return (
    <View style={{ width, height, overflow: "hidden" }} pointerEvents="none">
      {/* stylised fallback shows until tiles load / if offline */}
      {showFallback && (
        <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", opacity: 0.6 }]}>
          <MapBackground size={Math.max(width, height)} />
        </View>
      )}
      {tiles}
      {showFallback && <Text style={styles.attribution}>© OpenStreetMap · CARTO</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  attribution: {
    position: "absolute",
    bottom: 2,
    left: 6,
    fontSize: 8,
    color: "#9AA5AB",
  },
});
