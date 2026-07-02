import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import MapView, { Marker, Circle } from "react-native-maps";
import { colors, spacing, font } from "@/src/theme";
import type { NearbyUser, StatusOption } from "@/src/context/RadarContext";

const LIGHT_MAP = [
  { elementType: "geometry", stylers: [{ color: "#E8F1ED" }] },
  { elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "water", stylers: [{ color: "#BFE3DA" }] },
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
      customMapStyle={LIGHT_MAP}
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
        strokeColor="rgba(20,184,166,0.55)"
        fillColor="rgba(20,184,166,0.10)"
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
