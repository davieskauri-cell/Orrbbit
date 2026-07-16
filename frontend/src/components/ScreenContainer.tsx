import React from "react";
import { View, ScrollView, StyleSheet, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, layout } from "@/src/theme";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  testID?: string;
};

/** Standard screen wrapper: safe-area top, 24px page padding, surface background. */
export default function ScreenContainer({ children, scroll, style, contentStyle, testID }: Props) {
  const insets = useSafeAreaInsets();
  if (scroll) {
    return (
      <ScrollView
        style={[styles.flex, style]}
        contentContainerStyle={[
          {
            paddingTop: insets.top + layout.pageTop,
            paddingHorizontal: layout.pagePaddingH,
            paddingBottom: insets.bottom + layout.bottomSafe,
          },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
        testID={testID}
      >
        {children}
      </ScrollView>
    );
  }
  return (
    <View
      style={[
        styles.flex,
        { paddingTop: insets.top + layout.pageTop, paddingHorizontal: layout.pagePaddingH },
        style,
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
});
