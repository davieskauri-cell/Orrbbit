import React, { useRef, useCallback } from "react";
import { FlatList, Pressable, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, font } from "@/src/theme";

export type CategoryChipItem = {
  key: string;
  label?: string;
  icon?: string;
};

type Props = {
  items: CategoryChipItem[];
  activeKey?: string | null;
  onSelect?: (key: string) => void;
  renderChip?: (item: CategoryChipItem, index: number) => React.ReactElement;
  testID?: string;
  chipTestID?: (item: CategoryChipItem) => string;
};

/**
 * Shared horizontally-scrolling category chip row.
 * - Chips render at natural content width (flexShrink: 0, never stretched)
 * - Fixed 12px separator between chips; consistent screen-edge padding
 * - Unused space stays at the end of the row
 * - Selecting a partly off-screen chip gently scrolls it into view;
 *   fully visible chips never trigger scroll movement
 */
export default function HorizontalCategoryChipList({ items, activeKey, onSelect, renderChip, testID, chipTestID }: Props) {
  const listRef = useRef<FlatList<CategoryChipItem>>(null);
  const visibleKeys = useRef<Set<string>>(new Set());

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    visibleKeys.current = new Set(viewableItems.filter((v: any) => v.isViewable).map((v: any) => v.item.key));
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 95 }).current;

  const handleSelect = useCallback(
    (item: CategoryChipItem, index: number) => {
      onSelect?.(item.key);
      if (!visibleKeys.current.has(item.key)) {
        try {
          listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
        } catch {}
      }
    },
    [onSelect]
  );

  return (
    <FlatList
      ref={listRef}
      data={items}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={() => <View style={{ width: spacing.md }} />}
      keyExtractor={(item) => item.key}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      onScrollToIndexFailed={() => {}}
      testID={testID}
      renderItem={({ item, index }) => {
        if (renderChip) {
          return <View style={styles.chipWrap}>{renderChip(item, index)}</View>;
        }
        const isActive = item.key === activeKey;
        return (
          <View style={styles.chipWrap}>
            <Pressable
              testID={chipTestID ? chipTestID(item) : `chip-${item.key.toLowerCase()}`}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => handleSelect(item, index)}
            >
              {item.icon ? (
                <Ionicons name={item.icon as any} size={14} color={isActive ? "#FFF" : colors.textSecondary} />
              ) : null}
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{item.label || item.key}</Text>
            </Pressable>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    paddingBottom: spacing.sm,
  },
  chipWrap: { flexShrink: 0 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: 999,
    minHeight: 40,
  },
  chipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700" },
  chipTextActive: { color: "#FFF" },
});
