import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Chip, Badge, Btn, Loading, EmptyText, ModalCard, Input } from '../../src/control/ui';

const QUEUES = [
  { key: 'Pending', label: 'Pending' }, { key: 'Approved', label: 'Approved' },
  { key: 'Rejected', label: 'Rejected' }, { key: 'Expired', label: 'Expired' },
  { key: 'expiring_soon', label: 'Expiring Soon' }, { key: '', label: 'All' },
];

export default function Verifications() {
  const { req, mode } = useCC();
  const [queue, setQueue] = useState('Pending');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState<any>(null); // {sub, action}
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await req(`/verifications${queue ? `?status=${queue}` : ''}`)); }
    catch (e: any) { setError(e.message); setData({ items: [], counts: {} }); }
  }, [req, queue]);

  useEffect(() => { setData(null); load(); }, [load, mode]);

  const submitDecision = async () => {
    if (!decision) return;
    setBusy(true);
    try {
      await req(`/verifications/${decision.sub.id}/decision`, { method: 'POST', body: JSON.stringify({ action: decision.action, note }) });
      setDecision(null);
      setNote('');
      load();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const counts = data?.counts || {};
  return (
    <Shell title="Professional Verification">
      {error ? <Text style={{ color: CC.red, marginBottom: 8 }}>{error}</Text> : null}
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {QUEUES.map((qd) => (
            <Chip key={qd.key || 'all'} active={queue === qd.key} onPress={() => setQueue(qd.key)}
              label={`${qd.label}${counts[qd.key.toLowerCase()] !== undefined ? ` (${counts[qd.key.toLowerCase()]})` : ''}`} />
          ))}
        </View>
      </Card>
      {!data ? <Loading /> : !data.items.length ? <Card><EmptyText>No submissions in this queue.</EmptyText></Card> : data.items.map((sub: any) => (
        <Card key={sub.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {sub.user?.photo_url ? <Image source={{ uri: sub.user.photo_url }} style={s.avatar} /> : <View style={[s.avatar, { backgroundColor: CC.tealSoft }]} />}
            <View style={{ flex: 1, minWidth: 200 }}>
              <Text style={s.name}>{sub.user?.name} — {sub.profession}</Text>
              <Text style={s.sub}>{sub.user?.email} · {(sub.categories || []).join(', ')}</Text>
              <Text style={s.sub}>Submitted {String(sub.submitted_at).slice(0, 10)}{sub.valid_until ? ` · valid until ${sub.valid_until}` : ''}</Text>
            </View>
            <Badge status={sub.status} />
          </View>
          <View style={s.docs}>
            {(sub.documents || []).map((d: any) => (
              <View key={d.id} style={s.docChip}>
                <Text style={{ fontSize: 12, color: CC.navy, fontWeight: '600' }}>📄 {d.doc_name}</Text>
                <Text style={{ fontSize: 11, color: CC.sub }}>{d.issuer}{d.expiry_date ? ` · exp ${d.expiry_date}` : ''}</Text>
              </View>
            ))}
          </View>
          {sub.public_note ? <Text style={[s.sub, { marginTop: 6 }]}>Reviewer note: {sub.public_note}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {sub.status !== 'Approved' ? <Btn small variant="teal" title="Approve" onPress={() => setDecision({ sub, action: 'approve' })} /> : null}
            {sub.status !== 'Rejected' ? <Btn small variant="danger" title="Reject" onPress={() => setDecision({ sub, action: 'reject' })} /> : null}
            <Btn small variant="outline" title="Request More Info" onPress={() => setDecision({ sub, action: 'more_info' })} />
            {sub.status === 'Approved' ? <Btn small variant="outline" title="Renew" onPress={() => setDecision({ sub, action: 'renew' })} /> : null}
            {sub.status === 'Approved' ? <Btn small variant="outline" title="Suspend" onPress={() => setDecision({ sub, action: 'suspend' })} /> : null}
            {sub.status === 'Expired' ? <Btn small variant="outline" title="Revoke" onPress={() => setDecision({ sub, action: 'revoke' })} /> : null}
          </View>
        </Card>
      ))}

      <ModalCard visible={!!decision} title={`Confirm: ${decision?.action?.replace('_', ' ') || ''}`} onClose={() => setDecision(null)}>
        <Text style={{ color: CC.text, marginBottom: 10 }}>
          {decision?.sub?.user?.name} — {decision?.sub?.profession}. The professional will be notified. This action is audited.
        </Text>
        <Input placeholder="Reviewer note (visible to the professional for reject / more info / suspend)" value={note} onChangeText={setNote} multiline style={{ minHeight: 70 }} />
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <Btn variant="outline" title="Cancel" onPress={() => setDecision(null)} />
          <Btn title={busy ? 'Saving…' : 'Confirm decision'} disabled={busy} onPress={submitDecision} />
        </View>
      </ModalCard>
    </Shell>
  );
}

const s = StyleSheet.create({
  avatar: { width: 44, height: 44, borderRadius: 22 },
  name: { fontSize: 14, fontWeight: '800', color: CC.navy },
  sub: { fontSize: 12, color: CC.sub, marginTop: 2 },
  docs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  docChip: { borderWidth: 1, borderColor: CC.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
});
