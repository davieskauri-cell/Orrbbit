import React from "react";
import Svg, { Rect, Path, Line, Circle, Text as SvgText } from "react-native-svg";

/**
 * Stylised light map background (Apple Maps / Snap Map inspired, but softer).
 * Pure SVG — deterministic, cross-platform, no tiles, no real coordinates.
 */
export default function MapBackground({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* soft base */}
      <Rect x="0" y="0" width="100" height="100" fill="#F8FAF9" />

      {/* pale blue water — river across the top-right corner */}
      <Path
        d="M64 -2 C 58 12, 70 20, 84 24 C 94 27, 100 34, 102 40 L 102 -2 Z"
        fill="#DCEEF7"
      />
      <Path
        d="M70 -2 C 65 10, 75 17, 87 20 C 95 22.5, 100 28, 102 32 L 102 20 C 96 16, 88 12, 82 8 C 78 5, 76 1, 76 -2 Z"
        fill="#CFE7F3"
        opacity={0.6}
      />

      {/* pale green parks */}
      <Rect x="8" y="62" width="24" height="20" rx="3" fill="#E4F2E3" />
      <Rect x="70" y="66" width="22" height="18" rx="3" fill="#E4F2E3" />
      <Rect x="14" y="10" width="18" height="14" rx="3" fill="#EAF5E9" />
      {/* trees */}
      <Circle cx="16" cy="70" r="1.6" fill="#CBE5C9" />
      <Circle cx="24" cy="76" r="1.3" fill="#CBE5C9" />
      <Circle cx="78" cy="74" r="1.5" fill="#CBE5C9" />
      <Circle cx="22" cy="16" r="1.3" fill="#D6ECD4" />

      {/* city blocks (very subtle) */}
      <Rect x="40" y="34" width="12" height="9" rx="1.5" fill="#F0F2F3" />
      <Rect x="55" y="46" width="10" height="8" rx="1.5" fill="#F0F2F3" />
      <Rect x="38" y="70" width="11" height="9" rx="1.5" fill="#F0F2F3" />
      <Rect x="56" y="12" width="9" height="8" rx="1.5" fill="#F0F2F3" />
      <Rect x="8" y="38" width="10" height="8" rx="1.5" fill="#F0F2F3" />

      {/* street grid — light grey */}
      {[18, 44, 58, 88].map((y) => (
        <Line key={`h${y}`} x1="-2" y1={y} x2="102" y2={y} stroke="#E7EAEC" strokeWidth="1.4" />
      ))}
      {[12, 36, 52, 68, 96].map((x) => (
        <Line key={`v${x}`} x1={x} y1="-2" x2={x} y2="102" stroke="#E7EAEC" strokeWidth="1.4" />
      ))}
      {/* main avenues */}
      <Line x1="-2" y1="30" x2="102" y2="30" stroke="#E0E4E7" strokeWidth="2.4" />
      <Line x1="26" y1="-2" x2="26" y2="102" stroke="#E0E4E7" strokeWidth="2.4" />
      {/* diagonal boulevard */}
      <Line x1="-2" y1="92" x2="70" y2="-2" stroke="#E3E7EA" strokeWidth="2" />

      {/* minimal labels */}
      <SvgText x="18" y="74" fill="#AFC5B4" fontSize="3.2" fontWeight="600">
        Park
      </SvgText>
      <SvgText x="84" y="16" fill="#A9C4D4" fontSize="3.2" fontWeight="600">
        River
      </SvgText>
      <SvgText x="41" y="32.6" fill="#C3CBD1" fontSize="2.8">
        Collins St
      </SvgText>
    </Svg>
  );
}
