import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import MapView, { Marker, Circle } from "react-native-maps";
import { colors, spacing, font } from "@/src/theme";
import type { NearbyUser, StatusOption } from "@/src/context/RadarContext";

const DARK_MAP = [
  { elementType: "geometry", stylers: [{ color: "#0D110F" }] },
  { elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", stylers: [{ color: "#161B18" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "water", stylers: [{ color: "#08110D" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

type Props = {
  coords: { lat: number; lng: number } | null;
  radius: number;
  nearby: NearbyUser[];
  statusMap: Record<string, StatusOption>;
  onSelect: (u: NearbyUser) => void;
};

export default function NativeMap({ coords, radius, nearby, statusMap, onSelect }: Props) {
  if (!coords) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Locating you…</Text>
      </View>
    );
  }
  return (
    <MapView
      testID="map-view"
      style={StyleSheet.absoluteFill}
      customMapStyle={DARK_MAP}
      initialRegion={{
        latitude: coords.lat,
        longitude: coords.lng,
        latitudeDelta: 0.006,
        longitudeDelta: 0.006,
      }}
      showsUserLocation
      showsMyLocationButton={false}
    >
      <Circle
        center={{ latitude: coords.lat, longitude: coords.lng }}
        radius={radius}
        strokeColor="rgba(16,185,129,0.5)"
        fillColor="rgba(16,185,129,0.08)"
      />
      {nearby.map((u) => (
        <Marker
          key={u.id}
          coordinate={{ latitude: u.lat, longitude: u.lng }}
          onPress={() => onSelect(u)}
        >
          <View
            style={[
              styles.pin,
              { borderColor: (u.status && statusMap[u.status]?.color) || colors.onSurfaceSecondary },
            ]}
          >
            <Image source={{ uri: u.avatar_url || undefined }} style={styles.pinImg} />
          </View>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { color: colors.onSurfaceSecondary, fontSize: font.base },
  pin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: colors.surfaceTertiary,
  },
  pinImg: { width: "100%", height: "100%" },
});
