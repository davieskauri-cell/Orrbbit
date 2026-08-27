import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Shell from '../../src/control/Shell';
import { useCC, ApiError } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Chip, Badge, Btn, Loading, EmptyText, ErrorState, ModalCard, Input, ReauthModal } from '../../src/control/ui';
import { fmtDT } from '../../src/control/datetime';

const TABS = [
  { key: 'pending', label: 'Pending' }, { key: 'actioned', label: 'Actioned' },
  { key: 'dismissed', label: 'Dismissed' }, { key: '', label: 'All' },
];

export default function Reports() {
  const { req, reauth, mode } = useCC();
  const router = useRouter();
  const [tab, setTab] = useState('pending');
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState<any>(null); // {report, action}
  const [reason, setReason] = useState('');
  const [reauthFor, setReauthFor] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError('');
    try { setItems((await req(`/reports${tab ? `?status=${tab}` : ''}`)).items); }
    catch (e: any) { setLoadError(e.message || 'Unable to load production data.'); }
  }, [req, tab]);

  useEffect(() => { setItems(null); load(); }, [load, mode]);

  const act = async (reportId: string, action: string, why: string) => {
    setBusy(true);
    setError('');
    try {
      await req(`/reports/${reportId}/action`, { method: 'POST', body: JSON.stringify({ action, reason: why }) });
      setModal(null);
      setReason('');
      load();
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 428) { setReauthFor({ reportId, action, why }); return; }
      setError(e.message);
    } finally { setBusy(false); }
  };

  return (
    <Shell title="Reports & Moderation">
      {error ? <Text style={{ color: CC.red, marginBottom: 8 }}>{error}</Text> : null}
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TABS.map((t) => <Chip key={t.key || 'all'} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />)}
        </View>
      </Card>
      {loadError ? <Card><ErrorState message={loadError} onRetry={load} /></Card> : !items ? <Loading /> : !items.length ? <Card><EmptyText>No reports here.</EmptyText></Card> : items.map((r: any) => (
        <Card key={r.id || r.created_at}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 220 }}>
              <Text style={s.reason}>{r.reason}</Text>
              <Text style={s.sub}>
                Reported: <Text style={{ color: CC.teal }} onPress={() => r.target?.id && router.push(`/control/user/${r.target.id}` as any)}>{r.target?.name || 'Unknown'}</Text>
                {'  ·  '}By: {r.reporter?.name || 'Unknown'} · {fmtDT(String(r.created_at))}
              </Text>
              {r.details ? <Text style={[s.sub, { marginTop: 4 }]}>&ldquo;{r.details}&rdquo;</Text> : null}
            </View>
            <Badge status={r.status || 'pending'} label={r.action_taken ? `${r.status} (${r.action_taken})` : r.status || 'pending'} />
          </View>
          {(!r.status || r.status === 'pending' || r.status === 'open') ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <Btn small variant="outline" title="Warn" onPress={() => setModal({ report: r, action: 'warn' })} />
              <Btn small variant="outline" title="Suspend" onPress={() => setModal({ report: r, action: 'suspend' })} />
              <Btn small variant="danger" title="Ban" onPress={() => setModal({ report: r, action: 'ban' })} />
              <Btn small variant="ghost" title="Dismiss" onPress={() => act(r.id, 'dismiss', '')} />
            </View>
          ) : null}
        </Card>
      ))}

      <ModalCard visible={!!modal} title={`Confirm: ${modal?.action || ''} user`} onClose={() => setModal(null)}>
        <Text style={{ color: CC.text, marginBottom: 10 }}>
          Target: {modal?.report?.target?.name || 'Unknown'}. This action is audited{modal?.action !== 'warn' ? ' and requires re-authentication' : ''}.
        </Text>
        <Input placeholder="Reason (sent to the user for warnings)" value={reason} onChangeText={setReason} multiline style={{ minHeight: 60 }} />
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <Btn variant="outline" title="Cancel" onPress={() => setModal(null)} />
          <Btn variant={modal?.action === 'ban' ? 'danger' : 'primary'} title={busy ? 'Working…' : 'Confirm'} disabled={busy}
            onPress={() => act(modal.report.id, modal.action, reason)} />
        </View>
      </ModalCard>

      <ReauthModal visible={!!reauthFor} busy={busy} onCancel={() => { setReauthFor(null); setBusy(false); }}
        onSubmit={async (pw) => {
          try { await reauth(pw); const a = reauthFor; setReauthFor(null); await act(a.reportId, a.action, a.why); }
          catch (e: any) { setError(e.message); setBusy(false); }
        }} />
    </Shell>
  );
}

const s = StyleSheet.create({
  reason: { fontSize: 14, fontWeight: '800', color: CC.navy, textTransform: 'capitalize' },
  sub: { fontSize: 12, color: CC.sub, marginTop: 2 },
});
