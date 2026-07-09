import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, font } from "@/src/theme";

type Props = { details: Record<string, any>; vibeLabel?: string };

function ChipRow({ label, items }: { label: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.chips}>
        {items.map((i) => (
          <View key={i} style={styles.chip}>
            <Text style={styles.chipText}>{i}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MetaRow({ icon, text }: { icon: string; text?: string | null }) {
  if (!text) return null;
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon as any} size={14} color={colors.teal} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

export default function VibeDetailsCard({ details }: Props) {
  const d = details || {};
  const hasContent =
    d.intent || d.context || d.looking_for?.length || d.can_help_with?.length ||
    d.can_offer?.length || d.tags?.length || d.background || d.hiring_roles?.length ||
    d.values?.length || d.offer_categories?.length || d.training_type?.length;
  if (!hasContent) return null;

  const background = [d.background, d.industry, d.experience_level].filter(Boolean).join(" · ");
  const hiring = d.recruiter_mode || d.professional_identity === "Recruiter";

  return (
    <View style={styles.card} testID="vibe-details-card">
      <View style={styles.headerRow}>
        <Ionicons name="sparkles" size={14} color={colors.orange} />
        <Text style={styles.kicker}>VIBE DETAILS</Text>
      </View>
      {!!d.intent && <Text style={styles.intent}>{d.intent}</Text>}
      {!!d.context && <Text style={styles.context}>“{d.context}”</Text>}

      <MetaRow icon="briefcase" text={background || null} />
      <MetaRow icon="business" text={d.company} />
      <MetaRow icon="time" text={Array.isArray(d.preferred_time) ? d.preferred_time.join(", ") : d.time} />
      <MetaRow icon="location" text={d.setting} />
      {!!d.urgency && <MetaRow icon="alert-circle" text={d.urgency} />}
      {!!d.comfort_level && <MetaRow icon="chatbubble-ellipses" text={d.comfort_level} />}

      {hiring && (
        <View style={styles.hiringBox}>
          <Text style={styles.hiringTitle}>Hiring now</Text>
          {!!d.hiring_roles?.length && <Text style={styles.hiringLine}>Roles: {d.hiring_roles.join(", ")}</Text>}
          {!!d.hiring_experience && <Text style={styles.hiringLine}>Experience: {d.hiring_experience}</Text>}
          {!!d.work_type && <Text style={styles.hiringLine}>Work type: {d.work_type}{d.location_type ? ` · ${d.location_type}` : ""}</Text>}
          {!!d.salary_range && <Text style={styles.hiringLine}>Salary: {d.salary_range}</Text>}
        </View>
      )}

      {!!(d.target_role || d.skills) && (
        <View style={styles.hiringBox}>
          <Text style={styles.hiringTitle}>Job seeker</Text>
          {!!d.current_role && <Text style={styles.hiringLine}>Current: {d.current_role}</Text>}
          {!!d.target_role && <Text style={styles.hiringLine}>Target role: {d.target_role}</Text>}
          {!!d.skills && <Text style={styles.hiringLine}>Skills: {d.skills}</Text>}
          {d.open_to_recruiters !== undefined && (
            <Text style={styles.hiringLine}>Open to recruiters: {d.open_to_recruiters ? "Yes" : "No"}</Text>
          )}
        </View>
      )}

      <ChipRow label="Looking for" items={d.looking_for} />
      <ChipRow label="Can help with" items={d.can_help_with || d.can_offer || d.offer_categories} />
      {!!d.offer_experience && <MetaRow icon="ribbon" text={d.offer_experience} />}
      <ChipRow label="Values" items={d.values} />
      <ChipRow label="Training" items={d.training_type} />
      <ChipRow label="Tags" items={d.tags} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  kicker: { color: colors.orange, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  intent: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginTop: spacing.sm },
  context: { color: colors.textSecondary, fontSize: font.base, fontStyle: "italic", marginTop: 4, lineHeight: 21 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  metaText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600", flex: 1 },
  hiringBox: {
    backgroundColor: colors.tealSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  hiringTitle: { color: colors.teal, fontSize: font.sm, fontWeight: "800", marginBottom: 4 },
  hiringLine: { color: colors.text, fontSize: font.sm, marginTop: 2 },
  section: { marginTop: spacing.md },
  sectionLabel: { color: colors.textTertiary, fontSize: 11, fontWeight: "800", letterSpacing: 0.8, marginBottom: 6, textTransform: "uppercase" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: 999 },
  chipText: { color: colors.text, fontSize: font.sm, fontWeight: "600" },
});
