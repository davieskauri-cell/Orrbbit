import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, KpiCard, Badge, SectionTitle, Loading, EmptyText, ErrorState, Table, Tr, Td, Btn } from '../../src/control/ui';

export default function SystemHealth() {
  const { req } = useCC();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    req('/system-health').then(setData).catch((e: any) => setError(e.message || 'Unable to load production data.'));
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error && !data) return <Shell title="System Health"><Card><ErrorState message={error} onRetry={load} /></Card></Shell>;
  if (!data) return <Shell title="System Health"><Loading /></Shell>;
  const sv = data.services;

  return (
    <Shell title="System Health" actions={<Btn small variant="outline" title="Refresh" onPress={load} />}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
        {Object.entries(sv).map(([name, info]: any) => (
          <Card key={name} style={{ flexGrow: 1, flexBasis: 260, marginBottom: 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={s.svcName}>{name.replace(/_/g, ' ')}</Text>
              <Badge status={info.status} />
            </View>
            <Text style={s.svcDetail}>
              {info.latency_ms !== undefined && info.latency_ms !== null ? `Latency: ${info.latency_ms} ms` : ''}
              {info.used_gb !== undefined ? `Disk: ${info.used_gb} / ${info.total_gb} GB (${info.used_pct}%)` : ''}
              {info.total_mb ? `Memory: ${info.total_mb - info.available_mb} / ${info.total_mb} MB used` : ''}
              {info.status === 'not_configured' ? 'Provider not connected yet' : ''}
              {info.status === 'mocked' ? 'Delivered as in-app notifications until Firebase is configured' : ''}
            </Text>
          </Card>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        {Object.entries(data.collections).map(([k, v]: any) => <KpiCard key={k} label={k.replace(/_/g, ' ')} value={v} />)}
      </View>

      <Card>
        <SectionTitle>Background Jobs</SectionTitle>
        <Table columns={['Job', 'Type', 'Status', 'Details']} widths={[1.4, 1.4, 0.8, 1.2]}>
          {data.background_jobs.map((j: any) => (
            <Tr key={j.name}>
              <Td flex={1.4}>{j.name}</Td>
              <Td flex={1.4}>{j.type}</Td>
              <Td flex={0.8}><Badge status={j.status === 'healthy' ? 'active' : 'pending'} label={j.status} /></Td>
              <Td flex={1.2}>{j.queued !== undefined ? `${j.queued} queued` : j.last_run ? `Checked ${String(j.last_run).slice(11, 16)}` : '—'}</Td>
            </Tr>
          ))}
        </Table>
      </Card>

      <Card>
        <SectionTitle>Queues — Scheduled Notifications</SectionTitle>
        {!data.queues.scheduled_notifications.length ? <EmptyText>Queue empty.</EmptyText> :
          data.queues.scheduled_notifications.map((n: any) => (
            <View key={n.id} style={s.qRow}>
              <Text style={{ fontSize: 13, color: CC.text, flex: 1 }}>{n.title}</Text>
              <Text style={{ fontSize: 12, color: CC.sub }}>{n.targeted} targets · fires {String(n.scheduled_at).slice(0, 16).replace('T', ' ')}</Text>
            </View>
          ))}
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Card style={{ flexGrow: 1, flexBasis: 300, marginBottom: 0 }}>
          <SectionTitle>Security</SectionTitle>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 13, color: CC.text }}>Failed admin logins (24h)</Text>
            <Badge status={data.security.failed_admin_logins_24h > 5 ? 'banned' : 'active'} label={String(data.security.failed_admin_logins_24h)} />
          </View>
        </Card>
        <Card style={{ flexGrow: 1, flexBasis: 300, marginBottom: 0 }}>
          <SectionTitle>Crash Reports</SectionTitle>
          {!data.crash_reports.length ? <EmptyText>No crashes reported. 🎉</EmptyText> : null}
        </Card>
      </View>
    </Shell>
  );
}

const s = StyleSheet.create({
  svcName: { fontSize: 13, fontWeight: '800', color: CC.navy, textTransform: 'capitalize' },
  svcDetail: { fontSize: 12, color: CC.sub, marginTop: 6, minHeight: 16 },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
});
