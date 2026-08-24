import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Input, Chip, Btn, Badge, Loading, EmptyText, ErrorState, SectionTitle, Table, Tr, Td } from '../../src/control/ui';

const AUDIENCES = [
  { key: 'everyone', label: 'Everyone' }, { key: 'professionals', label: 'Professionals' },
  { key: 'people_mode', label: 'People Mode' }, { key: 'professional_mode', label: 'Professional Mode' },
  { key: 'city', label: 'City' }, { key: 'category', label: 'Category' },
];

export default function Notifications() {
  const { req, mode } = useCC();
  const [data, setData] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('everyone');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [schedule, setSchedule] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError('');
    try { setData(await req('/notifications')); }
    catch (e: any) { setLoadError(e.message || 'Unable to load production data.'); }
  }, [req]);

  useEffect(() => { setData(null); load(); }, [load, mode]);

  const send = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await req('/notifications', {
        method: 'POST',
        body: JSON.stringify({
          title, body, audience,
          city: audience === 'city' ? city : null,
          category: audience === 'category' ? category : null,
          scheduled_at: schedule || null,
        }),
      });
      setNotice(res.status === 'scheduled' ? `Scheduled for ${schedule} — will reach ${res.targeted} users.` : `Sent to ${res.targeted} users as in-app notifications (push is MOCKED until Firebase is configured).`);
      setTitle(''); setBody(''); setSchedule('');
      load();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Shell title="Notifications" actions={<Badge status="mocked" label="Push mocked — delivered in-app" />}>
      {error ? <Text style={{ color: CC.red, marginBottom: 8 }}>{error}</Text> : null}
      {notice ? <Card style={{ backgroundColor: CC.tealSoft, borderColor: CC.teal }}><Text style={{ color: CC.navy, fontSize: 13 }}>{notice}</Text></Card> : null}
      <Card>
        <SectionTitle>Compose notification</SectionTitle>
        <Input placeholder="Title" value={title} onChangeText={setTitle} />
        <Input placeholder="Message" value={body} onChangeText={setBody} multiline style={{ minHeight: 70, marginTop: 10 }} />
        <Text style={s.label}>Target audience</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {AUDIENCES.map((a) => <Chip key={a.key} label={a.label} active={audience === a.key} onPress={() => setAudience(a.key)} />)}
        </View>
        {audience === 'city' && data ? (
          <>
            <Text style={s.label}>City</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {data.cities.map((c: string) => <Chip key={c} label={c} active={city === c} onPress={() => setCity(c)} />)}
            </View>
          </>
        ) : null}
        {audience === 'category' && data ? (
          <>
            <Text style={s.label}>Professional category</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {data.categories.map((c: string) => <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />)}
            </View>
          </>
        ) : null}
        <Text style={s.label}>Schedule (optional — ISO format, e.g. 2026-06-20T09:00:00+00:00; leave empty to send now)</Text>
        <Input placeholder="YYYY-MM-DDTHH:MM:SS+00:00" value={schedule} onChangeText={setSchedule} />
        <View style={{ marginTop: 14, alignItems: 'flex-start' }}>
          <Btn title={busy ? 'Sending…' : schedule ? 'Schedule notification' : 'Send now'} disabled={busy || !title || !body} onPress={send} />
        </View>
      </Card>
      {loadError ? <Card><ErrorState message={loadError} onRetry={load} /></Card> : !data ? <Loading /> : (
        <Card>
          <SectionTitle>Delivery history</SectionTitle>
          <Table columns={['Title', 'Audience', 'Targeted', 'Delivered', 'Status', 'By', 'When']} widths={[1.6, 1, 0.7, 0.7, 0.9, 1.3, 1]}>
            {!data.items.length ? <EmptyText>No notifications sent yet.</EmptyText> : data.items.map((n: any) => (
              <Tr key={n.id}>
                <Td flex={1.6}>{n.title}</Td>
                <Td>{`${n.audience}${n.city ? ` (${n.city})` : ''}${n.category ? ` (${n.category})` : ''}`}</Td>
                <Td flex={0.7}>{n.targeted}</Td>
                <Td flex={0.7}>{n.delivered}</Td>
                <Td flex={0.9}><Badge status={n.status === 'sent' ? 'active' : 'pending'} label={n.status} /></Td>
                <Td flex={1.3}>{n.created_by}</Td>
                <Td>{String(n.sent_at || n.scheduled_at || n.created_at || '').slice(0, 16).replace('T', ' ')}</Td>
              </Tr>
            ))}
          </Table>
        </Card>
      )}
    </Shell>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', color: CC.navy, marginTop: 14, marginBottom: 6 },
});
