import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Badge, Loading, SectionTitle, Table, Tr, Td, KpiCard, EmptyText, ErrorState } from '../../src/control/ui';
import { fmtDT } from '../../src/control/datetime';

export default function Subscriptions() {
  const { req, mode } = useCC();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setData(null);
    setError(null);
    req('/billing/overview').then(setData).catch((e: any) => setError(e.message || 'Unable to load production data.'));
  };

  useEffect(() => { load(); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <Shell title="Subscriptions"><Card><ErrorState message={error} onRetry={load} /></Card></Shell>;
  if (!data) return <Shell title="Subscriptions"><Loading /></Shell>;
  return (
    <Shell title="Subscriptions" actions={<Badge status={mode === 'live' ? 'not_configured' : 'new'} label={mode === 'live' ? 'Not configured' : 'DEMO data'} />}>
      <Card style={{ backgroundColor: mode === 'live' ? '#F1F5F9' : CC.tealSoft, borderColor: mode === 'live' ? CC.border : CC.teal }}>
        <Text style={{ color: CC.navy, fontSize: 13 }}>{data.message}</Text>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <KpiCard label="Active Subscriptions" value={data.kpis.active_subscriptions ?? 'Not configured'} />
        <KpiCard label="MRR" value={data.kpis.mrr !== null && data.kpis.mrr !== undefined ? `$${data.kpis.mrr}` : 'Not configured'} />
        <KpiCard label="Failed Payments" value={data.kpis.failed_payments ?? 'Not configured'} />
        <KpiCard label="Refunds" value={data.kpis.refunds ?? 'Not configured'} />
      </View>
      <Card>
        <SectionTitle>Plans</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {data.plans.map((p: any) => (
            <View key={p.key} style={s.plan}>
              <Text style={s.planName}>{p.name}</Text>
              <Text style={s.planPrice}>{p.price === null ? 'Pricing set when provider connects' : `$${p.price}`}</Text>
              {p.features.map((f: string) => <Text key={f} style={s.feat}>• {f}</Text>)}
            </View>
          ))}
        </View>
      </Card>
      <Card>
        <SectionTitle>Subscriptions {mode === 'demo' ? '(seeded demo data)' : ''}</SectionTitle>
        {!data.subscriptions.length ? (
          <EmptyText>{mode === 'live' ? 'Payment integration not configured — no subscription records exist.' : 'No demo subscriptions.'}</EmptyText>
        ) : (
          <Table columns={['Customer', 'Plan', 'Status', 'Billing', 'Trial', 'Renews', 'Provider ref']} widths={[1.4, 1, 0.9, 0.8, 0.6, 1, 1]}>
            {data.subscriptions.map((sub: any) => (
              <Tr key={sub.id}>
                <Td flex={1.4}>{sub.customer}</Td>
                <Td>{String(sub.plan).replace('_', ' ')}</Td>
                <Td flex={0.9}><Badge status={sub.status === 'active' ? 'active' : sub.status === 'trialing' ? 'new' : sub.status === 'past_due' ? 'pending' : 'closed'} label={sub.status} /></Td>
                <Td flex={0.8}>{sub.billing_period}</Td>
                <Td flex={0.6}>{sub.trial ? 'Yes' : '—'}</Td>
                <Td>{sub.renews_at ? fmtDT(String(sub.renews_at), true) : sub.cancelled_at ? `cancelled ${fmtDT(String(sub.cancelled_at), true)}` : '—'}</Td>
                <Td>{sub.provider_ref}</Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>
    </Shell>
  );
}

const s = StyleSheet.create({
  plan: { borderWidth: 1, borderColor: CC.border, borderRadius: 10, padding: 14, flexGrow: 1, flexBasis: 220 },
  planName: { fontSize: 15, fontWeight: '800', color: CC.navy },
  planPrice: { fontSize: 12, color: CC.teal, fontWeight: '600', marginBottom: 8, marginTop: 2 },
  feat: { fontSize: 12, color: CC.sub, marginTop: 2 },
});
