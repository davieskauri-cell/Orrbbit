import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Input, Btn, Badge, Loading, SectionTitle, Chip, EmptyText } from '../../src/control/ui';

export default function Categories() {
  const { req, mode } = useCC();
  const [data, setData] = useState<any>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('help');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await req('/categories')); } catch (e: any) { setError(e.message); setData({}); }
  }, [req]);
  useEffect(() => { setData(null); load(); }, [load, mode]);

  const add = async () => {
    setBusy(true); setError('');
    try { await req('/categories', { method: 'POST', body: JSON.stringify({ name, kind }) }); setName(''); load(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (!data) return <Shell title="Categories"><Loading /></Shell>;
  return (
    <Shell title="Categories">
      {error ? <Text style={{ color: CC.red, marginBottom: 8 }}>{error}</Text> : null}
      <Card style={{ backgroundColor: CC.tealSoft, borderColor: CC.teal }}>
        <Text style={{ color: CC.navy, fontSize: 13 }}>{data.note}</Text>
      </Card>
      <Card>
        <SectionTitle>Stage a new category</SectionTitle>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input placeholder="Category name" value={name} onChangeText={setName} style={{ flex: 1, minWidth: 200 }} />
          <Chip label="Help category" active={kind === 'help'} onPress={() => setKind('help')} />
          <Chip label="Profession" active={kind === 'professional'} onPress={() => setKind('professional')} />
          <Btn small title="Add" disabled={busy || !name.trim()} onPress={add} />
        </View>
        {(data.custom || []).map((c: any) => (
          <View key={c.id} style={s.row}>
            <Text style={[s.name, { flex: 1 }]}>{c.name}</Text>
            <Badge status="pending" label={`custom · ${c.kind}`} />
          </View>
        ))}
        {!(data.custom || []).length ? <EmptyText>No custom categories staged.</EmptyText> : null}
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Card style={{ flexGrow: 1, flexBasis: 320, marginBottom: 0 }}>
          <SectionTitle>Help Request Categories (built-in)</SectionTitle>
          {(data.help_categories || []).map((c: any) => (
            <View key={c.name} style={s.row}>
              <Text style={[s.name, { flex: 1 }]}>{c.name}</Text>
              <Text style={s.sub}>{c.usage} requests</Text>
            </View>
          ))}
        </Card>
        <Card style={{ flexGrow: 1, flexBasis: 320, marginBottom: 0 }}>
          <SectionTitle>Professions (built-in)</SectionTitle>
          {(data.professions || []).map((c: any) => (
            <View key={c.name} style={s.row}>
              <Text style={[s.name, { flex: 1 }]}>{c.name}</Text>
              <Text style={s.sub}>{c.usage} profiles</Text>
            </View>
          ))}
        </Card>
      </View>
    </Shell>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  name: { fontSize: 13, fontWeight: '600', color: CC.text },
  sub: { fontSize: 12, color: CC.sub },
});
