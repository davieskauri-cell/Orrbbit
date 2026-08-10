import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, PanResponder } from "react-native";
import { colors, font } from "@/src/theme";

const MIN = 18;
const MAX = 65; // 65 means "65+" (no upper limit)
const THUMB = 28;

type Props = {
  valueMin: number;
  valueMax: number;
  onChange: (min: number, max: number) => void;
  onChangeEnd?: (min: number, max: number) => void;
  testID?: string;
};

export default function AgeRangeSlider({ valueMin, valueMax, onChange, onChangeEnd, testID }: Props) {
  const [trackW, setTrackW] = useState(0);
  const trackWRef = useRef(0);
  const vals = useRef({ min: valueMin, max: valueMax });
  vals.current = { min: valueMin, max: valueMax };
  const cb = useRef({ onChange, onChangeEnd });
  cb.current = { onChange, onChangeEnd };
  const startVal = useRef(0);

  const usable = () => Math.max(trackWRef.current - THUMB, 1);
  const toX = (v: number) => ((v - MIN) / (MAX - MIN)) * usable();
  const valueFromDx = (start: number, dx: number) =>
    Math.round(MIN + ((toX(start) + dx) / usable()) * (MAX - MIN));

  const makeResponder = (which: "min" | "max") =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startVal.current = which === "min" ? vals.current.min : vals.current.max;
      },
      onPanResponderMove: (_e, g) => {
        const raw = valueFromDx(startVal.current, g.dx);
        if (which === "min") {
          const v = Math.max(MIN, Math.min(raw, vals.current.max));
          if (v !== vals.current.min) cb.current.onChange(v, vals.current.max);
        } else {
          const v = Math.min(MAX, Math.max(raw, vals.current.min));
          if (v !== vals.current.max) cb.current.onChange(vals.current.min, v);
        }
      },
      onPanResponderRelease: () => cb.current.onChangeEnd?.(vals.current.min, vals.current.max),
      onPanResponderTerminate: () => cb.current.onChangeEnd?.(vals.current.min, vals.current.max),
    });

  const minPan = useRef(makeResponder("min")).current;
  const maxPan = useRef(makeResponder("max")).current;

  const a11yAdjust = (which: "min" | "max", delta: number) => {
    if (which === "min") {
      const v = Math.max(MIN, Math.min(vals.current.min + delta, vals.current.max));
      cb.current.onChange(v, vals.current.max);
      cb.current.onChangeEnd?.(v, vals.current.max);
    } else {
      const v = Math.min(MAX, Math.max(vals.current.max + delta, vals.current.min));
      cb.current.onChange(vals.current.min, v);
      cb.current.onChangeEnd?.(vals.current.min, v);
    }
  };

  const minX = toX(valueMin);
  const maxX = toX(valueMax);

  return (
    <View testID={testID}>
      <View
        style={styles.track}
        onLayout={(e) => {
          trackWRef.current = e.nativeEvent.layout.width;
          setTrackW(e.nativeEvent.layout.width);
        }}
      >
        <View style={styles.rail} />
        {trackW > 0 && (
          <>
            <View
              style={[styles.fill, { left: minX + THUMB / 2, width: Math.max(maxX - minX, 0) }]}
            />
            <View
              {...minPan.panHandlers}
              testID="age-slider-min"
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={`Minimum age, ${valueMin}`}
              accessibilityValue={{ min: MIN, max: valueMax, now: valueMin, text: `${valueMin}` }}
              accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
              onAccessibilityAction={(e) =>
                a11yAdjust("min", e.nativeEvent.actionName === "increment" ? 1 : -1)
              }
              style={[styles.thumb, { left: minX }]}
            />
            <View
              {...maxPan.panHandlers}
              testID="age-slider-max"
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={`Maximum age, ${valueMax >= MAX ? "65 plus" : valueMax}`}
              accessibilityValue={{
                min: valueMin,
                max: MAX,
                now: valueMax,
                text: valueMax >= MAX ? "65 plus" : `${valueMax}`,
              }}
              accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
              onAccessibilityAction={(e) =>
                a11yAdjust("max", e.nativeEvent.actionName === "increment" ? 1 : -1)
              }
              style={[styles.thumb, { left: maxX }]}
            />
          </>
        )}
      </View>
      <View style={styles.scaleRow}>
        <Text style={styles.scaleText}>18</Text>
        <Text style={styles.scaleText}>65+</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 44, justifyContent: "center" },
  rail: { height: 4, borderRadius: 2, backgroundColor: colors.border },
  fill: { position: "absolute", top: 20, height: 4, borderRadius: 2, backgroundColor: colors.teal },
  thumb: {
    position: "absolute",
    top: (44 - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: colors.teal,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  scaleRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  scaleText: { color: colors.textTertiary, fontSize: font.sm, fontWeight: "600" },
});
