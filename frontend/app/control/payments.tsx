import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Badge, Btn, Loading, SectionTitle, Table, Tr, Td, EmptyText } from '../../src/control/ui';
import { fmtDT } from '../../src/control/datetime';

export default function Payments() {
  const { req, mode } = useCC();
  const [data, setData] = useState<any>(null);
  const [integ, setInteg] = useState<any>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [o, i] = await Promise.all([req('/billing/overview'), req('/billing/integration')]);
      setData(o);
      setInteg(i);
    } catch (e: any) { setError(e.message); }
  }, [req]);

  useEffect(() => { setData(null); load(); }, [load, mode]);

  const refund = async (id: string) => {
    try { await req(`/billing/payments/${id}/refund`, { method: 'POST' }); load(); }
    catch (e: any) { setError(e.message); }
  };

  if (!data || !integ) return <Shell title="Payments">{error ? <EmptyText>{error}</EmptyText> : <Loading />}</Shell>;
  return (
    <Shell title="Payments" actions={<Badge status={mode === 'live' ? 'not_configured' : 'new'} label={mode === 'live' ? 'Not configured' : 'DEMO data'} />}>
      {error ? <Text style={{ color: CC.red, marginBottom: 8 }}>{error}</Text> : null}

      <Card>
        <SectionTitle>Payment Integration Settings</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
          <View style={s.chip}><Text style={s.chipK}>Provider</Text><Badge status="not_configured" label={integ.provider.name || 'none'} /></View>
          <View style={s.chip}><Text style={s.chipK}>Environment</Text><Badge status="not_configured" label={integ.provider.environment || 'n/a'} /></View>
          <View style={s.chip}><Text style={s.chipK}>Webhook</Text><Badge status="pending" label={integ.webhook.status} /></View>
          <View style={s.chip}><Text style={s.chipK}>Last webhook</Text><Text style={s.chipV}>{integ.webhook.last_received ? fmtDT(String(integ.webhook.last_received)) : 'never'}</Text></View>
          <View style={s.chip}><Text style={s.chipK}>Last sync</Text><Text style={s.chipV}>{integ.last_successful_sync || 'never'}</Text></View>
        </View>
        <Text style={s.sub}>Webhook endpoint: <Text style={{ fontWeight: '700' }}>{integ.webhook.url}</Text> · Supported events: {integ.webhook.supported_events.join(', ')}</Text>
        {integ.configuration_errors.map((e: string) => (
          <Text key={e} style={[s.sub, { color: CC.amber, marginTop: 6 }]}>⚠ {e}</Text>
        ))}
        <Text style={[s.sub, { marginTop: 8 }]}>{integ.security}</Text>
      </Card>

      <Card>
        <SectionTitle>Transactions {mode === 'demo' ? '(seeded demo data — no real money)' : ''}</SectionTitle>
        {!data.payments.length ? (
          <EmptyText>{mode === 'live' ? 'Payment integration not configured — no transactions exist and payment actions are disabled.' : 'No demo payments.'}</EmptyText>
        ) : (
          <Table columns={['Invoice', 'Customer', 'Plan', 'Amount', 'Status', 'Date', 'Actions']} widths={[1.1, 1.2, 1, 0.7, 0.9, 0.9, 1]}>
            {data.payments.map((p: any) => (
              <Tr key={p.id}>
                <Td flex={1.1}>{p.invoice_no}</Td>
                <Td flex={1.2}>{p.customer}</Td>
                <Td>{String(p.plan).replace('_', ' ')}</Td>
                <Td flex={0.7}>{`$${p.amount}`}</Td>
                <Td flex={0.9}><Badge status={p.refunded ? 'closed' : p.status === 'succeeded' ? 'active' : 'banned'} label={p.refunded ? 'refunded' : p.status} /></Td>
                <Td flex={0.9}>{fmtDT(String(p.created_at), true)}</Td>
                <Td>
                  {data.actions_enabled && p.status === 'succeeded' && !p.refunded
                    ? <Btn small variant="outline" title="Refund (demo)" onPress={() => refund(p.id)} />
                    : <Text style={s.sub}>{mode === 'live' ? 'disabled' : '—'}</Text>}
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>
    </Shell>
  );
}

const s = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: CC.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  chipK: { fontSize: 12, fontWeight: '700', color: CC.navy },
  chipV: { fontSize: 12, color: CC.sub },
  sub: { fontSize: 12, color: CC.sub },
});
