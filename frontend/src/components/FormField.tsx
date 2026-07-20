import React from "react";
import { View, Text, TextInput, StyleSheet, ViewStyle, TextInputProps } from "react-native";
import { colors, spacing, radius, font, controlHeight } from "@/src/theme";

type Props = TextInputProps & {
  label: string;
  helper?: string;
  helperRight?: string;
  error?: string | null;
  containerStyle?: ViewStyle;
  inputTestID?: string;
};

/** Standard form field: label + input + helper/error row. */
export default function FormField({
  label,
  helper,
  helperRight,
  error,
  containerStyle,
  inputTestID,
  style,
  ...inputProps
}: Props) {
  return (
    <View style={containerStyle}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={inputTestID}
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, !!error && styles.inputError, style]}
        {...inputProps}
      />
      {(helper || helperRight || error) && (
        <View style={styles.helperRow}>
          <Text style={[styles.helper, !!error && styles.errorText]}>{error || helper || ""}</Text>
          {!!helperRight && <Text style={styles.helper}>{helperRight}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.textSecondary,
    fontSize: font.sm,
    fontWeight: "600",
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: font.lg,
    minHeight: controlHeight.input,
  },
  inputError: { borderColor: colors.pink },
  helperRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  helper: { color: colors.textTertiary, fontSize: font.sm },
  errorText: { color: colors.pink },
});
