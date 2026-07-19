import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useCC } from './ControlContext';
import { CC } from './theme';
import { Card, SectionTitle, KpiCard, Loading, EmptyText, Badge } from './ui';

export function BarList({ items, color }: { items: { label: string; count: number }[]; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <View>
      {items.map((i) => (
        <View key={i.label} style={s.barRow}>
          <Text style={s.barLabel} numberOfLines={1}>{String(i.label).replace(/_/g, ' ')}</Text>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${(i.count / max) * 100}%`, backgroundColor: color || CC.teal }]} />
          </View>
          <Text style={s.barCount}>{i.count}</Text>
        </View>
      ))}
      {!items.length ? <EmptyText>No data.</EmptyText> : null}
    </View>
  );
}

const STAT_LABELS: Record<string, string> = {
  visible_users: 'Visible Users', active_24h: 'Active (24h)', ghost_mode: 'Ghost Mode', paused: 'Paused',
  professionals: 'Professionals', open_help_requests: 'Open Help Requests', available_now: 'Available Now',
};

export default function RadarPanel({ kind }: { kind: 'people' | 'professional' }) {
  const { req, mode } = useCC();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    setData(null);
    req(`/radar-insights?kind=${kind}`).then(setData).catch(() => setData({ stats: {}, sample: [] }));
  }, [mode, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <Loading />;
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        {Object.entries(data.stats || {}).map(([k, v]: any) => (
          <KpiCard key={k} label={STAT_LABELS[k] || k} value={v} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Card style={{ flexGrow: 1, flexBasis: 300, marginBottom: 0 }}>
          <SectionTitle>{kind === 'people' ? 'By Vibe' : 'Professionals by Category'}</SectionTitle>
          <BarList items={data.by_vibe || data.by_category || []} />
        </Card>
        <Card style={{ flexGrow: 1, flexBasis: 300, marginBottom: 0 }}>
          <SectionTitle>Most Active Areas</SectionTitle>
          <BarList items={data.hot_areas || []} color={CC.orange} />
        </Card>
        <Card style={{ flexGrow: 1, flexBasis: 300, marginBottom: 0 }}>
          <SectionTitle>{kind === 'people' ? 'By Intent' : 'Help Requests by Category'}</SectionTitle>
          <BarList items={data.by_intent || data.requests_by_category || []} color={CC.navy} />
        </Card>
      </View>
      <Card style={{ marginTop: 16 }}>
        <SectionTitle>{kind === 'people' ? 'Recently Active Users' : 'Professionals on Radar'}</SectionTitle>
        {(data.sample || []).map((u: any) => (
          <View key={u.id || u.user_id} style={s.row}>
            {u.photo_url ? <Image source={{ uri: u.photo_url }} style={s.avatar} /> : <View style={[s.avatar, { backgroundColor: CC.tealSoft }]} />}
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{u.name}{u.profession ? ` — ${u.profession}` : ''}</Text>
              <Text style={s.sub}>{u.city || '—'}{u.vibe ? ` · ${String(u.vibe).replace(/_/g, ' ')}` : ''}{u.primary_category ? ` · ${u.primary_category}` : ''}</Text>
            </View>
            {u.availability ? <Badge status={u.availability === 'Available now' ? 'active' : 'pending'} label={u.availability} /> : null}
            <Text style={s.sub}>{u.last_active ? String(u.last_active).slice(0, 16).replace('T', ' ') : ''}</Text>
          </View>
        ))}
        {!(data.sample || []).length ? <EmptyText>No activity right now.</EmptyText> : null}
      </Card>
    </>
  );
}

const s = StyleSheet.create({
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  barLabel: { width: 120, fontSize: 12, color: CC.text, textTransform: 'capitalize' },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  barCount: { width: 34, fontSize: 12, color: CC.sub, textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  avatar: { width: 30, height: 30, borderRadius: 15 },
  name: { fontSize: 13, fontWeight: '600', color: CC.text },
  sub: { fontSize: 11, color: CC.sub },
});
