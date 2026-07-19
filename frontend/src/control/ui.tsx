import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Modal, ActivityIndicator, ScrollView } from 'react-native';
import Svg, { Polyline, Polygon, Line } from 'react-native-svg';
import { CC, STATUS_COLORS } from './theme';

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={s.sectionRow}>
      <Text style={s.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function KpiCard({ label, value, accent }: { label: string; value: any; accent?: string }) {
  return (
    <View style={[s.kpi, accent ? { borderTopColor: accent, borderTopWidth: 3 } : null]}>
      <Text style={s.kpiValue}>{value === null || value === undefined ? '—' : String(value)}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

export function Badge({ status, label }: { status?: string; label?: string }) {
  const c = STATUS_COLORS[status || ''] || { bg: '#F1F5F9', fg: CC.sub };
  return (
    <View style={[s.badge, { backgroundColor: c.bg }]}>
      <Text style={[s.badgeText, { color: c.fg }]}>{(label || status || '—').replace(/_/g, ' ')}</Text>
    </View>
  );
}

export function Btn({
  title, onPress, variant = 'primary', small, disabled,
}: { title: string; onPress: () => void; variant?: 'primary' | 'outline' | 'danger' | 'ghost' | 'teal'; small?: boolean; disabled?: boolean }) {
  const base: any = [s.btn, small && s.btnSmall, disabled && { opacity: 0.5 }];
  const txt: any = [s.btnText, small && { fontSize: 12 }];
  if (variant === 'primary') base.push({ backgroundColor: CC.orange });
  if (variant === 'teal') base.push({ backgroundColor: CC.teal });
  if (variant === 'danger') base.push({ backgroundColor: CC.red });
  if (variant === 'outline') {
    base.push({ backgroundColor: CC.surface, borderWidth: 1, borderColor: CC.border });
    txt.push({ color: CC.navy });
  }
  if (variant === 'ghost') {
    base.push({ backgroundColor: 'transparent' });
    txt.push({ color: CC.teal });
  }
  return (
    <Pressable style={({ pressed }) => [...base, pressed && { opacity: 0.85 }]} onPress={onPress} disabled={disabled}>
      <Text style={txt}>{title}</Text>
    </Pressable>
  );
}

export function Input(props: any) {
  return <TextInput placeholderTextColor={CC.sub} {...props} style={[s.input, props.style]} />;
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && { backgroundColor: CC.navy, borderColor: CC.navy }]}>
      <Text style={[s.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Table({ columns, widths, children }: { columns: string[]; widths?: number[]; children: React.ReactNode }) {
  return (
    <View style={s.table}>
      <View style={[s.tr, s.thead]}>
        {columns.map((c, i) => (
          <Text key={c} style={[s.th, { flex: widths?.[i] ?? 1 }]}>{c}</Text>
        ))}
      </View>
      {children}
    </View>
  );
}

export function Tr({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ hovered, pressed }: any) => [s.tr, (hovered || pressed) && onPress ? { backgroundColor: '#F8FAFC' } : null]}>
      {children}
    </Pressable>
  );
}

export function Td({ children, flex = 1 }: { children: React.ReactNode; flex?: number }) {
  return (
    <View style={{ flex, paddingRight: 8, justifyContent: 'center' }}>
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text style={s.td} numberOfLines={2}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

export function EmptyText({ children }: { children: React.ReactNode }) {
  return <Text style={s.empty}>{children}</Text>;
}

export function Loading() {
  return (
    <View style={{ padding: 48, alignItems: 'center' }}>
      <ActivityIndicator color={CC.teal} size="large" />
    </View>
  );
}

export function Pager({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <View style={s.pager}>
      <Text style={s.pagerText}>{total} results — page {page} of {pages}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn small variant="outline" title="Prev" disabled={page <= 1} onPress={() => onPage(page - 1)} />
        <Btn small variant="outline" title="Next" disabled={page >= pages} onPress={() => onPage(page + 1)} />
      </View>
    </View>
  );
}

export function MiniChart({ data, color, height = 90 }: { data: { date: string; count: number }[]; color?: string; height?: number }) {
  const w = 260;
  const max = Math.max(1, ...data.map((d) => d.count));
  const pts = data.map((d, i) => `${(i / Math.max(1, data.length - 1)) * w},${height - (d.count / max) * (height - 10)}`);
  const fillPts = `0,${height} ${pts.join(' ')} ${w},${height}`;
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <Line x1="0" y1={height - 0.5} x2={w} y2={height - 0.5} stroke={CC.border} strokeWidth="1" />
      <Polygon points={fillPts} fill={color || CC.teal} opacity={0.12} />
      <Polyline points={pts.join(' ')} fill="none" stroke={color || CC.teal} strokeWidth="2" />
    </Svg>
  );
}

export function ModalCard({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalBg}>
        <View style={s.modalCard}>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>{title}</Text>
            <Pressable onPress={onClose}><Text style={{ color: CC.sub, fontSize: 18 }}>✕</Text></Pressable>
          </View>
          <ScrollView style={{ maxHeight: 480 }}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function ReauthModal({ visible, onCancel, onSubmit, busy }: { visible: boolean; onCancel: () => void; onSubmit: (password: string) => void; busy?: boolean }) {
  const [pw, setPw] = useState('');
  return (
    <ModalCard visible={visible} title="Confirm your identity" onClose={onCancel}>
      <Text style={{ color: CC.sub, marginBottom: 12 }}>
        This is a high-risk action. Re-enter your admin password to continue (valid for 5 minutes).
      </Text>
      <Input placeholder="Admin password" secureTextEntry value={pw} onChangeText={setPw} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <Btn variant="outline" title="Cancel" onPress={onCancel} />
        <Btn title={busy ? 'Verifying…' : 'Confirm'} disabled={busy || !pw} onPress={() => { onSubmit(pw); setPw(''); }} />
      </View>
    </ModalCard>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: CC.surface, borderRadius: 12, borderWidth: 1, borderColor: CC.border, padding: 16, marginBottom: 16 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: CC.navy },
  kpi: { backgroundColor: CC.surface, borderRadius: 10, borderWidth: 1, borderColor: CC.border, padding: 14, minWidth: 150, flexGrow: 1, flexBasis: 150 },
  kpiValue: { fontSize: 22, fontWeight: '800', color: CC.navy },
  kpiLabel: { fontSize: 12, color: CC.sub, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  btn: { backgroundColor: CC.orange, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 40 },
  btnSmall: { paddingHorizontal: 10, paddingVertical: 6, minHeight: 30 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  input: { borderWidth: 1, borderColor: CC.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: CC.text, backgroundColor: CC.surface, minHeight: 42 },
  chip: { borderWidth: 1, borderColor: CC.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: CC.surface },
  chipText: { fontSize: 12, color: CC.text, fontWeight: '600' },
  table: { borderWidth: 1, borderColor: CC.border, borderRadius: 10, overflow: 'hidden', backgroundColor: CC.surface },
  thead: { backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: CC.border },
  th: { fontSize: 11, fontWeight: '700', color: CC.sub, textTransform: 'uppercase', paddingRight: 8 },
  tr: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'center' },
  td: { fontSize: 13, color: CC.text },
  empty: { color: CC.sub, fontSize: 13, padding: 16, textAlign: 'center' },
  pager: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  pagerText: { fontSize: 12, color: CC.sub },
  modalBg: { flex: 1, backgroundColor: 'rgba(15,29,58,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: CC.surface, borderRadius: 14, padding: 20, width: '100%', maxWidth: 480 },
});
