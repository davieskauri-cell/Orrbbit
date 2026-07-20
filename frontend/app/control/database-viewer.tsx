import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Badge, Loading, SectionTitle, Chip, EmptyText, Input, Pager } from '../../src/control/ui';

export default function DatabaseViewer() {
  const { req, admin } = useCC();
  const [colls, setColls] = useState<any[] | null>(null);
  const [active, setActive] = useState('users');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const isSuper = admin?.role === 'super_admin';

  useEffect(() => {
    if (!isSuper) return;
    req('/db/collections').then((d) => setColls(d.items)).catch((e) => { setError(e.message); setColls([]); });
  }, [isSuper]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (!isSuper) return;
    try { setData(await req(`/db/${active}?page=${page}&limit=20${q ? `&q=${encodeURIComponent(q)}` : ''}`)); }
    catch (e: any) { setError(e.message); setData({ items: [], total: 0 }); }
  }, [req, active, page, q, isSuper]);

  useEffect(() => { const t = setTimeout(load, q ? 350 : 0); return () => clearTimeout(t); }, [load]);
  useEffect(() => { setPage(1); }, [active, q]);

  if (!isSuper) return <Shell title="Database Viewer"><Card><EmptyText>Super Admin only.</EmptyText></Card></Shell>;
  return (
    <Shell title="Database Viewer" actions={<Badge status="pending" label="Read-only · access audited" />}>
      {error ? <Text style={{ color: CC.red, marginBottom: 8 }}>{error}</Text> : null}
      {!colls ? <Loading /> : (
        <>
          <Card>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {colls.map((c) => <Chip key={c.name} label={`${c.name} (${c.count})`} active={active === c.name} onPress={() => { setActive(c.name); setData(null); }} />)}
            </View>
          </Card>
          <Card>
            <SectionTitle right={data ? <Badge status="new" label={`${data.total} docs`} /> : undefined}>{active}</SectionTitle>
            <Input placeholder="Search id / email / name / user_id / status / category…" value={q} onChangeText={setQ} />
            {!data ? <Loading /> : !data.items.length ? <EmptyText>No documents.</EmptyText> : data.items.map((doc: any, i: number) => (
              <ScrollView key={i} horizontal style={s.doc} showsHorizontalScrollIndicator={false}>
                <Text style={s.json}>{JSON.stringify(doc, null, 1).slice(0, 2000)}</Text>
              </ScrollView>
            ))}
            {data ? <Pager page={page} total={data.total} limit={20} onPage={setPage} /> : null}
          </Card>
        </>
      )}
    </Shell>
  );
}

const s = StyleSheet.create({
  doc: { backgroundColor: '#0F1D3A', borderRadius: 8, padding: 10, marginTop: 8, maxHeight: 180 },
  json: { color: '#A7F3D0', fontSize: 11, fontFamily: 'monospace' as any },
});
