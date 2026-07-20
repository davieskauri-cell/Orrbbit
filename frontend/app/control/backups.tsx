import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC, ApiError } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Badge, Btn, Loading, SectionTitle, EmptyText, ModalCard, ReauthModal } from '../../src/control/ui';

export default function Backups() {
  const { req, download, reauth, admin } = useCC();
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<any>(null);
  const [reauthFor, setReauthFor] = useState<any>(null);

  const isSuper = admin?.role === 'super_admin';

  const load = useCallback(async () => {
    try { setItems((await req('/backups')).items); }
    catch (e: any) { setError(e.message); setItems([]); }
  }, [req]);
  useEffect(() => { if (isSuper) load(); }, [load, isSuper]);

  const run = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const d = await req('/backups/run', { method: 'POST' });
      setNotice(d.ok ? `Backup completed — ${d.backup.size_mb} MB.` : 'Backup failed, check the log.');
      load();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const restore = async (id: string) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await req(`/backups/${id}/restore`, { method: 'POST' });
      setNotice('Database restored from backup snapshot.');
      load();
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 428) { setReauthFor(id); return; }
      setError(e.message);
    } finally { setBusy(false); }
  };

  if (!isSuper) return <Shell title="Backups"><Card><EmptyText>Super Admin only.</EmptyText></Card></Shell>;
  return (
    <Shell title="Backups" actions={<Btn small title={busy ? 'Working…' : 'Run manual backup'} disabled={busy} onPress={run} />}>
      {error ? <Text style={{ color: CC.red, marginBottom: 8 }}>{error}</Text> : null}
      {notice ? <Card style={{ backgroundColor: CC.tealSoft, borderColor: CC.teal }}><Text style={{ color: CC.navy, fontSize: 13 }}>{notice}</Text></Card> : null}
      {!items ? <Loading /> : (
        <Card>
          <SectionTitle>Backup history</SectionTitle>
          {!items.length ? <EmptyText>No backups yet. Run your first manual backup above.</EmptyText> : items.map((b) => (
            <View key={b.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{String(b.started_at).slice(0, 19).replace('T', ' ')} — {b.size_mb} MB</Text>
                <Text style={s.sub}>{b.path} · by {b.by}</Text>
              </View>
              <Badge status={b.status === 'completed' ? 'active' : 'banned'} label={b.status} />
              <Btn small variant="ghost" title="Log" onPress={() => download(`/backups/${b.id}/log`, `backup-${b.id.slice(0, 8)}.log`).catch((e) => setError(e.message))} />
              {b.status === 'completed' ? <Btn small variant="danger" title="Restore" disabled={busy} onPress={() => setConfirmRestore(b)} /> : null}
            </View>
          ))}
        </Card>
      )}
      <ModalCard visible={!!confirmRestore} title="Restore database?" onClose={() => setConfirmRestore(null)}>
        <Text style={{ color: CC.text, marginBottom: 16 }}>
          ⚠ This REPLACES the entire current database with the snapshot from {String(confirmRestore?.started_at || '').slice(0, 19).replace('T', ' ')}.
          Everything created since then will be lost. Re-authentication is required.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="outline" title="Cancel" onPress={() => setConfirmRestore(null)} />
          <Btn variant="danger" title="Restore snapshot" onPress={() => { const b = confirmRestore; setConfirmRestore(null); restore(b.id); }} />
        </View>
      </ModalCard>
      <ReauthModal visible={!!reauthFor} busy={busy} onCancel={() => { setReauthFor(null); setBusy(false); }}
        onSubmit={async (pw) => {
          try { await reauth(pw); const id = reauthFor; setReauthFor(null); await restore(id); }
          catch (e: any) { setError(e.message); setBusy(false); }
        }} />
    </Shell>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  name: { fontSize: 13, fontWeight: '700', color: CC.navy },
  sub: { fontSize: 11, color: CC.sub, marginTop: 2 },
});
