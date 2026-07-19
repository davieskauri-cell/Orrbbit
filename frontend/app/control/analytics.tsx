import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, KpiCard, SectionTitle, MiniChart, Loading, EmptyText } from '../../src/control/ui';
import { BarList } from '../../src/control/RadarPanel';

const SERIES: [string, string, string][] = [
  ['signups', 'Sign-ups (30d)', CC.teal], ['connections', 'Connections (30d)', CC.orange],
  ['pings', 'Pings (30d)', CC.blue], ['help_requests', 'Help Requests (30d)', CC.navy],
  ['professional_growth', 'Professional Growth (30d)', CC.green],
];

export default function Analytics() {
  const { req, mode } = useCC();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    setData(null);
    req('/analytics').then(setData).catch(() => setData(null));
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <Shell title="Analytics"><Loading /></Shell>;
  const k = data.kpis;
  const funnelMax = Math.max(1, ...(data.funnel || []).map((f: any) => f.count));

  return (
    <Shell title="Analytics">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <KpiCard label="DAU" value={k.dau} />
        <KpiCard label="WAU" value={k.wau} />
        <KpiCard label="MAU" value={k.mau} />
        <KpiCard label="Connections (30d)" value={k.connections_30d} />
        <KpiCard label="Pings (30d)" value={k.pings_30d} />
        <KpiCard label="Help Requests (30d)" value={k.help_requests_30d} />
        <KpiCard label="Avg Session Length" value={k.session_length === null ? 'Not tracked' : k.session_length} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
        {SERIES.map(([key, label, color]) => (
          <Card key={key} style={{ flexGrow: 1, flexBasis: 280, marginBottom: 0 }}>
            <Text style={s.chartTitle}>{label}</Text>
            <MiniChart data={data.series[key] || []} color={color} />
          </Card>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Card style={{ flexGrow: 1, flexBasis: 300, marginBottom: 0 }}>
          <SectionTitle>Conversion Funnel</SectionTitle>
          {(data.funnel || []).map((f: any, i: number) => (
            <View key={f.stage} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                <Text style={s.funnelLabel}>{i + 1}. {f.stage}</Text>
                <Text style={s.funnelCount}>{f.count}{i > 0 && data.funnel[0].count ? ` (${Math.round((f.count / data.funnel[0].count) * 100)}%)` : ''}</Text>
              </View>
              <View style={s.track}><View style={[s.fill, { width: `${(f.count / funnelMax) * 100}%` }]} /></View>
            </View>
          ))}
        </Card>
        <Card style={{ flexGrow: 1, flexBasis: 300, marginBottom: 0 }}>
          <SectionTitle>Retention (weekly cohorts, active in last 7d)</SectionTitle>
          {(data.retention_cohorts || []).map((c: any) => (
            <View key={c.cohort} style={s.cohortRow}>
              <Text style={s.funnelLabel}>{c.cohort}</Text>
              <Text style={s.funnelCount}>{c.size ? `${c.retained}/${c.size} · ${c.rate}%` : 'No sign-ups'}</Text>
            </View>
          ))}
          {!(data.retention_cohorts || []).some((c: any) => c.size) ? <EmptyText>No recent sign-up cohorts to measure.</EmptyText> : null}
        </Card>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16 }}>
        <Card style={{ flexGrow: 1, flexBasis: 280, marginBottom: 0 }}>
          <SectionTitle>Popular Help Categories</SectionTitle>
          <BarList items={data.popular_categories || []} />
        </Card>
        <Card style={{ flexGrow: 1, flexBasis: 280, marginBottom: 0 }}>
          <SectionTitle>Popular Locations</SectionTitle>
          <BarList items={data.popular_locations || []} color={CC.orange} />
        </Card>
        <Card style={{ flexGrow: 1, flexBasis: 280, marginBottom: 0 }}>
          <SectionTitle>Professional Categories</SectionTitle>
          <BarList items={data.professional_categories || []} color={CC.navy} />
        </Card>
      </View>
    </Shell>
  );
}

const s = StyleSheet.create({
  chartTitle: { fontSize: 13, fontWeight: '700', color: CC.navy, marginBottom: 8 },
  funnelLabel: { fontSize: 13, color: CC.text, fontWeight: '600' },
  funnelCount: { fontSize: 12, color: CC.sub },
  track: { height: 10, borderRadius: 5, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5, backgroundColor: CC.teal },
  cohortRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
});
