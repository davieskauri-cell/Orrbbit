import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, font } from "@/src/theme";

// Single source of truth for conversation prompts — used by BOTH the initial
// Profile Setup and Edit Profile so onboarding and profile data never diverge.
export const PROMPT_LIBRARY = [
  "Ask me about...",
  "My ideal weekend is...",
  "Something I'm working towards...",
  "You'll probably find me...",
  "I'm always up for...",
  "A random fact about me...",
  "Currently obsessed with...",
  "The easiest way to start a conversation with me is...",
  "I moved here from...",
  "I'd love to meet people who...",
];
export const MAX_PROMPTS = 3;

export type PromptItem = { prompt: string; answer: string };

export default function PromptsEditor({ prompts, onChange }: { prompts: PromptItem[]; onChange: (p: PromptItem[]) => void }) {
  const [showPicker, setShowPicker] = useState(false);
  const setAnswer = (i: number, t: string) => onChange(prompts.map((p, j) => (j === i ? { ...p, answer: t } : p)));
  const remove = (i: number) => onChange(prompts.filter((_, j) => j !== i));
  const moveUp = (i: number) => {
    const c = [...prompts];
    [c[i - 1], c[i]] = [c[i], c[i - 1]];
    onChange(c);
  };
  const add = (p: string) => {
    onChange([...prompts, { prompt: p, answer: "" }]);
    setShowPicker(false);
  };
  return (
    <View>
      {prompts.map((p, i) => (
        <View key={`${p.prompt}-${i}`} style={s.promptCard} testID={`prompt-card-${i}`}>
          <View style={s.promptHead}>
            <Text style={s.promptTitle}>{p.prompt}</Text>
            {i > 0 && (
              <Pressable testID={`prompt-up-${i}`} onPress={() => moveUp(i)} hitSlop={8}>
                <Ionicons name="arrow-up" size={16} color={colors.textSecondary} />
              </Pressable>
            )}
            <Pressable testID={`prompt-remove-${i}`} onPress={() => remove(i)} hitSlop={8}>
              <Ionicons name="trash-outline" size={16} color={colors.pink} />
            </Pressable>
          </View>
          <TextInput
            testID={`prompt-answer-${i}`}
            value={p.answer}
            onChangeText={(t) => setAnswer(i, t)}
            multiline
            maxLength={180}
            style={s.input}
            placeholder="Your answer (up to 180 characters)…"
            placeholderTextColor={colors.textTertiary}
          />
        </View>
      ))}
      {prompts.length < MAX_PROMPTS && !showPicker && (
        <Pressable testID="add-prompt" style={s.addPromptBtn} onPress={() => setShowPicker(true)}>
          <Ionicons name="add" size={18} color={colors.teal} />
          <Text style={s.addPromptText}>Add a prompt</Text>
        </Pressable>
      )}
      {showPicker && (
        <View style={s.promptPicker} testID="prompt-picker">
          {PROMPT_LIBRARY.filter((p) => !prompts.some((x) => x.prompt === p)).map((p) => (
            <Pressable key={p} testID={`prompt-option-${p.slice(0, 12)}`} style={s.promptOption} onPress={() => add(p)}>
              <Text style={s.promptOptionText}>{p}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setShowPicker(false)} style={{ alignSelf: "center", padding: spacing.sm }}>
            <Text style={{ color: colors.textSecondary, fontWeight: "700" }}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  promptCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md, gap: spacing.sm },
  promptHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  promptTitle: { flex: 1, fontWeight: "800", color: colors.text, fontSize: font.base },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.text, minHeight: 60, textAlignVertical: "top" },
  addPromptBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.teal, borderRadius: radius.md, paddingVertical: spacing.md, marginBottom: spacing.md },
  addPromptText: { color: colors.teal, fontWeight: "800", fontSize: font.base },
  promptPicker: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginBottom: spacing.md },
  promptOption: { paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  promptOptionText: { color: colors.text, fontWeight: "600", fontSize: font.base },
});
