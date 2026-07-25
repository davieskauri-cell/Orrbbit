import { StyleSheet, Text, TextStyle } from "react-native";

// Quicksand hierarchy (rounded, matches the Orrbbit wordmark): 700+→Bold, 600→SemiBold, 500→Medium, else Regular.
function familyFor(weight?: TextStyle["fontWeight"]): string {
  const w = String(weight ?? "400");
  if (w === "bold" || parseInt(w, 10) >= 700) return "Quicksand-Bold";
  if (parseInt(w, 10) >= 600) return "Quicksand-SemiBold";
  if (parseInt(w, 10) >= 500) return "Quicksand-Medium";
  return "Quicksand-Regular";
}

let applied = false;

/**
 * Apply Quicksand globally by injecting a fontFamily into <Text> props BEFORE the
 * original render runs — the style array then flows through the normal RN /
 * RN-web style resolution (never touches raw DOM style, so no CSSStyleDeclaration
 * crashes). Explicit fontFamily styles (e.g. icon fonts) are left untouched.
 */
export function applyGlobalFont() {
  if (applied) return;
  applied = true;
  const TextAny = Text as any;
  const origRender = TextAny.render;
  if (typeof origRender !== "function") return;
  TextAny.render = function (props: any, ref: any) {
    let nextProps = props;
    try {
      const flat = (StyleSheet.flatten(props?.style) || {}) as TextStyle;
      if (!flat.fontFamily) {
        nextProps = { ...props, style: [props?.style, { fontFamily: familyFor(flat.fontWeight) }] };
      }
    } catch {
      nextProps = props;
    }
    return origRender.call(this, nextProps, ref);
  };
}
