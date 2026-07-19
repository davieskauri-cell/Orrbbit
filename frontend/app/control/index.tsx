import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, KpiCard, Badge, Btn, SectionTitle, MiniChart, Loading, EmptyText } from '../../src/control/ui';

const KPI_DEFS: [string, string, string?][] = [
  ['total_users', 'Total Users'], ['online_users', 'Online Users'], ['new_users_today', 'New Users Today'],
  ['dau', 'Daily Active Users'], ['mau', 'Monthly Active Users'], ['professionals', 'Professionals'],
  ['verified_professionals', 'Verified Professionals'], ['pending_verification', 'Pending Verification'],
  ['expired_credentials', 'Expired Credentials'], ['help_requests', 'Active Help Requests'],
  ['connections_today', 'Connections Today'], ['messages_today', 'Pings Today'],
  ['reports_pending', 'Reports Pending'], ['subscriptions', 'Subscriptions'], ['revenue', 'Revenue'],
];

const CHART_DEFS: [string, string, string][] = [
  ['user_growth', 'User Growth (30d)', CC.teal],
  ['connections', 'Connections (30d)', CC.orange],
  ['messages', 'Pings (30d)', CC.blue],
  ['help_requests', 'Help Requests (30d)', CC.navy],
  ['professional_growth', 'Professional Growth (30d)', CC.green],
  ['reports', 'Reports (30d)', CC.red],
];

export default function Dashboard() {
  const { req, mode } = useCC();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [actions, setActions] = useState<any>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [d, a] = await Promise.all([req('/dashboard'), req('/action-required')]);
      setData(d);
      setActions(a);
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
  }, [req]);

  useEffect(() => { setData(null); load(); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (subId: string, action: string) => {
    try {
      await req(`/verifications/${subId}/decision`, { method: 'POST', body: JSON.stringify({ action, note: '' }) });
      load();
    } catch (e: any) { setError(e.message); }
  };

  if (!data) return <Shell title="Dashboard">{error ? <EmptyText>{error}</EmptyText> : <Loading />}</Shell>;

  const notConfigured = (k: string) => k === 'subscriptions' || k === 'revenue';
  const totalActions =
    (actions?.pending_verifications?.length || 0) + (actions?.reports_pending?.length || 0) +
    (actions?.expired_credentials?.length || 0) + (actions?.expiring_soon?.length || 0);

  return (
    <Shell title="Dashboard" actions={<Badge status={mode === 'live' ? 'banned' : 'new'} label={mode === 'live' ? 'LIVE data' : 'DEMO data'} />}>
      {error ? <Text style={{ color: CC.red, marginBottom: 12 }}>{error}</Text> : null}

      <View style={s.kpiGrid}>
        {KPI_DEFS.map(([key, label]) => (
          <KpiCard key={key} label={label} value={notConfigured(key) ? 'Not configured' : data.kpis[key]}
            accent={key === 'reports_pending' && data.kpis[key] > 0 ? CC.red : key === 'pending_verification' && data.kpis[key] > 0 ? CC.amber : undefined} />
        ))}
      </View>

      <Card>
        <SectionTitle>System Status</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {Object.entries(data.system).map(([k, v]: any) => (
            <View key={k} style={s.sysChip}>
              <Text style={s.sysLabel}>{k.replace(/_/g, ' ')}</Text>
              <Badge status={v} />
            </View>
          ))}
        </View>
      </Card>

      <View style={s.chartGrid}>
        {CHART_DEFS.map(([key, label, color]) => (
          <Card key={key} style={{ flexGrow: 1, flexBasis: 300, marginBottom: 0 }}>
            <Text style={s.chartTitle}>{label}</Text>
            <MiniChart data={data.graphs[key] || []} color={color} />
            <Text style={s.chartSum}>Total: {(data.graphs[key] || []).reduce((a: number, b: any) => a + b.count, 0)}</Text>
          </Card>
        ))}
      </View>

      <Card style={{ marginTop: 16 }}>
        <SectionTitle right={<Badge status={totalActions > 0 ? 'pending' : 'active'} label={`${totalActions} items`} />}>
          Action Required
        </SectionTitle>
        {totalActions === 0 ? <EmptyText>Nothing needs your attention right now. 🎉</EmptyText> : null}
        {actions?.pending_verifications?.map((v: any) => (
          <View key={v.id} style={s.actionRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.actionName}>{v.user?.name} — {v.profession}</Text>
              <Text style={s.actionSub}>Verification pending since {String(v.submitted_at).slice(0, 10)}</Text>
            </View>
            <Btn small variant="teal" title="Approve" onPress={() => decide(v.id, 'approve')} />
            <Btn small variant="danger" title="Reject" onPress={() => decide(v.id, 'reject')} />
            <Btn small variant="outline" title="Open" onPress={() => router.push('/control/verifications' as any)} />
          </View>
        ))}
        {actions?.reports_pending?.map((r: any) => (
          <View key={r.id} style={s.actionRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.actionName}>Report — {r.reason}</Text>
              <Text style={s.actionSub}>By {r.user?.name || 'Unknown'} · {String(r.created_at).slice(0, 10)}</Text>
            </View>
            <Btn small variant="outline" title="Review" onPress={() => router.push('/control/reports' as any)} />
          </View>
        ))}
        {actions?.expired_credentials?.map((v: any) => (
          <View key={v.id} style={s.actionRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.actionName}>{v.user?.name} — expired credentials</Text>
              <Text style={s.actionSub}>{v.profession}</Text>
            </View>
            <Btn small variant="outline" title="Open" onPress={() => router.push('/control/verifications' as any)} />
          </View>
        ))}
        {actions?.expiring_soon?.map((v: any) => (
          <View key={v.id} style={s.actionRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.actionName}>{v.user?.name} — credentials expiring soon</Text>
              <Text style={s.actionSub}>{v.profession}</Text>
            </View>
            <Btn small variant="teal" title="Renew" onPress={() => decide(v.id, 'renew')} />
            <Btn small variant="outline" title="Open" onPress={() => router.push('/control/verifications' as any)} />
          </View>
        ))}
      </Card>

      <Card>
        <SectionTitle right={<Btn small variant="ghost" title="Open Command Centre →" onPress={() => router.push('/control/command-centre' as any)} />}>
          Live Activity
        </SectionTitle>
        <ActivityPreview />
      </Card>
    </Shell>
  );
}

function ActivityPreview() {
  const { req, mode } = useCC();
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => {
    req('/activity?window=7d').then((d) => setItems(d.items.slice(0, 8))).catch(() => setItems([]));
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!items) return <Loading />;
  if (!items.length) return <EmptyText>No recent activity.</EmptyText>;
  return (
    <View>
      {items.map((it, i) => (
        <View key={i} style={s.feedRow}>
          <View style={[s.feedDot, { backgroundColor: it.category === 'reports' ? CC.red : it.category === 'verification' ? CC.amber : CC.teal }]} />
          <Text style={s.feedText} numberOfLines={1}>
            <Text style={{ fontWeight: '700' }}>{it.name || 'System'}</Text> · {String(it.type).replace(/_/g, ' ')}
            {it.location ? ` · ${it.location}` : ''}
          </Text>
          <Text style={s.feedTime}>{String(it.time).slice(0, 16).replace('T', ' ')}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  sysChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: CC.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  sysLabel: { fontSize: 12, color: CC.text, fontWeight: '600', textTransform: 'capitalize' },
  chartGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  chartTitle: { fontSize: 13, fontWeight: '700', color: CC.navy, marginBottom: 8 },
  chartSum: { fontSize: 11, color: CC.sub, marginTop: 6 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  actionName: { fontSize: 13, fontWeight: '700', color: CC.text },
  actionSub: { fontSize: 12, color: CC.sub },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  feedDot: { width: 8, height: 8, borderRadius: 4 },
  feedText: { flex: 1, fontSize: 13, color: CC.text },
  feedTime: { fontSize: 11, color: CC.sub },
});
