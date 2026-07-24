import React from "react";
import { StyleSheet, Text, TextStyle } from "react-native";

// Poppins hierarchy: 700+→Bold, 600→SemiBold, 500→Medium, else Regular.
function familyFor(weight?: TextStyle["fontWeight"]): string {
  const w = String(weight ?? "400");
  if (w === "bold" || parseInt(w, 10) >= 700) return "Poppins-Bold";
  if (parseInt(w, 10) >= 600) return "Poppins-SemiBold";
  if (parseInt(w, 10) >= 500) return "Poppins-Medium";
  return "Poppins-Regular";
}

let applied = false;

/** Apply Poppins globally by mapping each <Text> fontWeight to the matching Poppins file. */
export function applyGlobalFont() {
  if (applied) return;
  applied = true;
  const TextAny = Text as any;
  const origRender = TextAny.render;
  if (typeof origRender !== "function") return;
  TextAny.render = function (...args: any[]) {
    const el = origRender.apply(this, args);
    if (!el) return el;
    const flat = StyleSheet.flatten(el.props?.style) as TextStyle | undefined;
    if (flat?.fontFamily) return el; // explicit families win
    const fontFamily = familyFor(flat?.fontWeight);
    return React.cloneElement(el, { style: [el.props.style, { fontFamily }] });
  };
}
