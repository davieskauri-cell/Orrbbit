import { resolvePhotoUri } from "@/src/lib/photo";
import React, { useEffect, useState, useCallback } from 'react';
import { View, Image, Text } from 'react-native';
import { useRouter } from 'expo-router';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Input, Chip, Table, Tr, Td, Badge, Loading, EmptyText, Pager } from '../../src/control/ui';

const STATUSES = [
  { key: '', label: 'All' }, { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' }, { key: 'banned', label: 'Banned' },
];

export default function Users() {
  const { req, mode } = useCC();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const d = await req(`/users?page=${page}&limit=25${q ? `&q=${encodeURIComponent(q)}` : ''}${status ? `&status=${status}` : ''}`);
      setData(d);
    } catch { setData({ items: [], total: 0 }); }
  }, [req, page, q, status]);

  useEffect(() => { const t = setTimeout(load, q ? 350 : 0); return () => clearTimeout(t); }, [load, mode]);
  useEffect(() => { setPage(1); }, [q, status, mode]);

  return (
    <Shell title="Users">
      <Card>
        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input placeholder="Search name, email or ID…" value={q} onChangeText={setQ} style={{ flex: 1, minWidth: 220 }} />
          {STATUSES.map((st) => <Chip key={st.key} label={st.label} active={status === st.key} onPress={() => setStatus(st.key)} />)}
        </View>
      </Card>
      {!data ? <Loading /> : (
        <Card>
          <Table columns={['User', 'Email', 'City', 'Mode', 'Plan', 'Status', 'Joined']} widths={[1.6, 1.8, 1, 0.9, 0.7, 1, 1]}>
            {!data.items.length ? <EmptyText>No users found.</EmptyText> : data.items.map((u: any) => (
              <Tr key={u.id} onPress={() => router.push(`/control/user/${u.id}` as any)}>
                <Td flex={1.6}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {u.photo_url ? <Image source={{ uri: resolvePhotoUri(u.photo_url) }} style={{ width: 28, height: 28, borderRadius: 14 }} /> : <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: CC.tealSoft }} />}
                    <Text style={{ fontSize: 13, color: CC.text, fontWeight: '600' }} numberOfLines={1}>{u.name}</Text>
                    {u.verified ? <Text style={{ color: CC.teal, fontSize: 12 }}>✓</Text> : null}
                  </View>
                </Td>
                <Td flex={1.8}>{u.email}</Td>
                <Td>{u.city || '—'}</Td>
                <Td flex={0.9}>{u.app_mode === 'professional' ? 'Professional' : 'People'}</Td>
                <Td flex={0.7}>{u.plan || 'free'}</Td>
                <Td><Badge status={u.admin_status === 'banned' ? 'banned' : u.admin_status === 'hidden_pending_review' ? 'suspended' : 'active'} /></Td>
                <Td>{String(u.created_at || '').slice(0, 10)}</Td>
              </Tr>
            ))}
          </Table>
          <Pager page={data.page || page} total={data.total} limit={25} onPage={setPage} />
        </Card>
      )}
    </Shell>
  );
}
