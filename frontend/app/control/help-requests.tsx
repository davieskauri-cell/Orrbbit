import React, { useEffect, useState, useCallback } from 'react';
import { View, Text } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC, ApiError } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Input, Chip, Table, Tr, Td, Badge, Btn, Loading, EmptyText, ErrorState, Pager, ReauthModal } from '../../src/control/ui';
import { fmtDT } from '../../src/control/datetime';

const STATUSES = ['', 'active', 'paused', 'closed'];

export default function HelpRequests() {
  const { req, reauth, mode } = useCC();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [reauthFor, setReauthFor] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await req(`/help-requests?page=${page}&limit=25${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`));
      setLoadError('');
    } catch (e: any) { setLoadError(e.message || 'Unable to load production data.'); }
  }, [req, page, q, status]);

  useEffect(() => { const t = setTimeout(load, q ? 350 : 0); return () => clearTimeout(t); }, [load, mode]);
  useEffect(() => { setPage(1); }, [q, status, mode]);

  const act = async (id: string, action: string) => {
    setBusy(true);
    setError('');
    try {
      await req(`/help-requests/${id}/action`, { method: 'POST', body: JSON.stringify({ action }) });
      load();
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 428) { setReauthFor({ id, action }); return; }
      setError(e.message);
    } finally { setBusy(false); }
  };

  return (
    <Shell title="Help Requests">
      {error ? <Text style={{ color: CC.red, marginBottom: 8 }}>{error}</Text> : null}
      <Card>
        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input placeholder="Search summaries…" value={q} onChangeText={setQ} style={{ flex: 1, minWidth: 220 }} />
          {STATUSES.map((st) => <Chip key={st || 'all'} label={st || 'All'} active={status === st} onPress={() => setStatus(st)} />)}
        </View>
      </Card>
      {loadError ? <Card><ErrorState message={loadError} onRetry={load} /></Card> : !data ? <Loading /> : (
        <Card>
          <Table columns={['Summary', 'Category', 'Posted by', 'Payment', 'Status', 'Created', 'Actions']} widths={[2, 0.9, 1.2, 0.9, 0.8, 0.9, 1.6]}>
            {!data.items.length ? <EmptyText>No help requests found.</EmptyText> : data.items.map((r: any) => (
              <Tr key={r.id}>
                <Td flex={2}>
                  <Text style={{ fontSize: 13, color: CC.text, fontWeight: '600' }} numberOfLines={2}>
                    {r.featured ? '⭐ ' : ''}{r.public_summary}
                  </Text>
                </Td>
                <Td flex={0.9}>{r.category}</Td>
                <Td flex={1.2}>{r.user?.name || '—'}</Td>
                <Td flex={0.9}>{r.payment || '—'}</Td>
                <Td flex={0.8}><Badge status={r.status} /></Td>
                <Td flex={0.9}>{fmtDT(String(r.created_at || ''), true)}</Td>
                <Td flex={1.6}>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {r.status === 'active' ? <Btn small variant="outline" title="Close" disabled={busy} onPress={() => act(r.id, 'close')} /> : null}
                    <Btn small variant="teal" title={r.featured ? 'Unfeature' : 'Feature'} disabled={busy} onPress={() => act(r.id, r.featured ? 'unfeature' : 'feature')} />
                    <Btn small variant="danger" title="Delete" disabled={busy} onPress={() => act(r.id, 'delete')} />
                  </View>
                </Td>
              </Tr>
            ))}
          </Table>
          <Pager page={page} total={data.total} limit={25} onPage={setPage} />
        </Card>
      )}
      <ReauthModal visible={!!reauthFor} busy={busy} onCancel={() => { setReauthFor(null); setBusy(false); }}
        onSubmit={async (pw) => {
          try { await reauth(pw); const a = reauthFor; setReauthFor(null); await act(a.id, a.action); }
          catch (e: any) { setError(e.message); setBusy(false); }
        }} />
    </Shell>
  );
}
