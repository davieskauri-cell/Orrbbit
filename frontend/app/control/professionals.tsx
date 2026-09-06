import { resolvePhotoUri } from "@/src/lib/photo";
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Input, Chip, Table, Tr, Td, Badge, Loading, EmptyText, ErrorState, Pager } from '../../src/control/ui';
import VerificationQueue from '../../src/control/VerificationQueue';

const VSTATUSES = ['', 'Approved', 'Pending', 'Rejected', 'Expired', 'Not submitted'];

/** Single merged Professionals screen: Directory + Verification review queue. */
export default function Professionals() {
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'directory' | 'verification'>(tabParam === 'verification' ? 'verification' : 'directory');
  useEffect(() => { if (tabParam === 'verification') setTab('verification'); }, [tabParam]);

  return (
    <Shell title="Professionals">
      <View style={st.segments}>
        <Pressable testID="pro-tab-directory" style={[st.seg, tab === 'directory' && st.segOn]} onPress={() => setTab('directory')}>
          <Text style={[st.segTxt, tab === 'directory' && st.segTxtOn]}>Directory</Text>
        </Pressable>
        <Pressable testID="pro-tab-verification" style={[st.seg, tab === 'verification' && st.segOn]} onPress={() => setTab('verification')}>
          <Text style={[st.segTxt, tab === 'verification' && st.segTxtOn]}>Verification</Text>
        </Pressable>
      </View>
      {tab === 'directory' ? <Directory /> : <VerificationQueue />}
    </Shell>
  );
}

function Directory() {
  const { req, mode } = useCC();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await req(`/professionals?page=${page}&limit=25${q ? `&q=${encodeURIComponent(q)}` : ''}${status ? `&status=${encodeURIComponent(status)}` : ''}`));
    } catch (e: any) { setError(e.message || 'Unable to load production data.'); }
  }, [req, page, q, status]);

  useEffect(() => { const t = setTimeout(load, q ? 350 : 0); return () => clearTimeout(t); }, [load, mode]);
  useEffect(() => { setPage(1); }, [q, status, mode]);

  return (
    <View>
      <Card>
        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input placeholder="Search name, profession or category…" value={q} onChangeText={setQ} style={{ flex: 1, minWidth: 220 }} />
          {VSTATUSES.map((s) => <Chip key={s || 'all'} label={s || 'All'} active={status === s} onPress={() => setStatus(s)} />)}
        </View>
      </Card>
      {error ? <Card><ErrorState message={error} onRetry={load} /></Card> : !data ? <Loading /> : (
        <Card>
          <Table columns={['Professional', 'Profession', 'Category', 'Verification', 'Credential Expiry', 'City']} widths={[1.5, 1.3, 1, 1, 1, 0.8]}>
            {!data.items.length ? <EmptyText>No professionals found.</EmptyText> : data.items.map((p: any) => (
              <Tr key={p.user_id} onPress={() => router.push(`/control/user/${p.user_id}` as any)}>
                <Td flex={1.5}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {p.user?.photo_url ? <Image source={{ uri: resolvePhotoUri(p.user.photo_url) }} style={{ width: 28, height: 28, borderRadius: 14 }} /> : <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: CC.tealSoft }} />}
                    <Text style={{ fontSize: 13, color: CC.text, fontWeight: '600' }} numberOfLines={1}>{p.user?.name || '—'}</Text>
                  </View>
                </Td>
                <Td flex={1.3}>{p.profession}</Td>
                <Td>{p.primary_category}</Td>
                <Td><Badge status={p.verification_status} /></Td>
                <Td>{p.credential_expiry || '—'}</Td>
                <Td flex={0.8}>{p.user?.city || '—'}</Td>
              </Tr>
            ))}
          </Table>
          <Pager page={page} total={data.total} limit={25} onPage={setPage} />
        </Card>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  segments: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  seg: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: CC.border, backgroundColor: '#FFF' },
  segOn: { backgroundColor: CC.navy, borderColor: CC.navy },
  segTxt: { fontSize: 13, fontWeight: '700', color: CC.navy },
  segTxtOn: { color: '#FFF' },
});
