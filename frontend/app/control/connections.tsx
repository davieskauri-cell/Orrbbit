import { resolvePhotoUri } from "@/src/lib/photo";
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image } from 'react-native';
import { useRouter } from 'expo-router';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Chip, Table, Tr, Td, Badge, Loading, EmptyText, Pager, KpiCard } from '../../src/control/ui';

const TABS = [
  { key: 'pending', label: 'Pending' }, { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' }, { key: 'expired', label: 'Expired' }, { key: '', label: 'All' },
];

export default function Connections() {
  const { req, mode } = useCC();
  const router = useRouter();
  const [tab, setTab] = useState('pending');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    try { setData(await req(`/connections?page=${page}&limit=25${tab ? `&status=${tab}` : ''}`)); }
    catch { setData({ items: [], total: 0, counts: {} }); }
  }, [req, page, tab]);

  useEffect(() => { setData(null); load(); }, [load, mode]);
  useEffect(() => { setPage(1); }, [tab, mode]);

  const c = data?.counts || {};
  return (
    <Shell title="Connections">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <KpiCard label="Pending Requests" value={c.pending} />
        <KpiCard label="Accepted" value={c.accepted} accent={CC.green} />
        <KpiCard label="Rejected" value={c.rejected} />
        <KpiCard label="Expired" value={c.expired} />
        <KpiCard label="Active Connections" value={c.active_matches} accent={CC.teal} />
      </View>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TABS.map((t) => <Chip key={t.key || 'all'} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />)}
        </View>
      </Card>
      {!data ? <Loading /> : (
        <Card>
          <Table columns={['From', 'To', 'About', 'Vibe', 'Status', 'Created']} widths={[1.5, 1.5, 0.9, 1, 0.9, 1]}>
            {!data.items.length ? <EmptyText>No connection requests here.</EmptyText> : data.items.map((r: any) => (
              <Tr key={r.id} onPress={() => router.push(`/control/user/${r.from_user_id}` as any)}>
                <Td flex={1.5}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {r.from_user?.photo_url ? <Image source={{ uri: resolvePhotoUri(r.from_user.photo_url) }} style={{ width: 26, height: 26, borderRadius: 13 }} /> : <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: CC.tealSoft }} />}
                    <Text style={{ fontSize: 13, color: CC.text, fontWeight: '600' }} numberOfLines={1}>{r.from_user?.name || '—'}</Text>
                  </View>
                </Td>
                <Td flex={1.5}>{r.to_user?.name || '—'}</Td>
                <Td flex={0.9}>{r.about || 'connect'}</Td>
                <Td>{String(r.vibe || '').replace(/_/g, ' ')}</Td>
                <Td flex={0.9}><Badge status={r.display_status} /></Td>
                <Td>{String(r.created_at || '').slice(0, 16).replace('T', ' ')}</Td>
              </Tr>
            ))}
          </Table>
          <Pager page={page} total={data.total} limit={25} onPage={setPage} />
        </Card>
      )}
    </Shell>
  );
}
