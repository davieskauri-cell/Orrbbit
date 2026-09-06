import React, { useEffect, useState } from "react";
import { Image } from "react-native";
import { colors } from "@/src/theme";

/**
 * Full event photo/poster — renders at the image's own aspect ratio so nothing
 * is cropped (portrait posters, square flyers and landscape photos all show fully).
 */
export default function EventPoster({ uri, radius = 18, style }: { uri: string; radius?: number; style?: object }) {
  const [aspect, setAspect] = useState(16 / 9);
  useEffect(() => {
    let live = true;
    Image.getSize(uri, (w, h) => { if (live && w > 0 && h > 0) setAspect(Math.max(w / h, 0.5)); }, () => {});
    return () => { live = false; };
  }, [uri]);
  return (
    <Image
      source={{ uri }}
      style={[{ width: "100%", aspectRatio: aspect, borderRadius: radius, backgroundColor: colors.border }, style]}
      resizeMode="cover"
    />
  );
}
