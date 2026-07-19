import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Input, Btn, Badge, Loading, SectionTitle } from '../../src/control/ui';

export default function Settings() {
  const { req, admin } = useCC();
  const [items, setItems] = useState<any[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');

  const isSuper = admin?.role === 'super_admin';

  const load = useCallback(async () => {
    try {
      const d = await req('/app-config');
      setItems(d.items);
      const v: Record<string, string> = {};
      d.items.forEach((i: any) => { v[i.key] = i.value; });
      setValues(v);
    } catch (e: any) { setError(e.message); setItems([]); }
  }, [req]);

  useEffect(() => { load(); }, [load]);

  const save = async (key: string) => {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await req('/app-config', { method: 'PUT', body: JSON.stringify({ key, value: values[key] }) });
      setNotice('Saved and audited.');
      load();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(''); }
  };

  return (
    <Shell title="Settings — App Configuration">
      {error ? <Text style={{ color: CC.red, marginBottom: 8 }}>{error}</Text> : null}
      {notice ? <Card style={{ backgroundColor: CC.tealSoft, borderColor: CC.teal }}><Text style={{ color: CC.navy, fontSize: 13 }}>{notice}</Text></Card> : null}
      {!isSuper ? (
        <Card><Text style={{ color: CC.sub, fontSize: 13 }}>Configuration is read-only for your role. Only Super Admins can change app settings.</Text></Card>
      ) : null}
      {!items ? <Loading /> : (
        <Card>
          <SectionTitle>Platform configuration</SectionTitle>
          {items.map((c) => (
            <View key={c.key} style={s.row}>
              <View style={{ flex: 1, minWidth: 220 }}>
                <Text style={s.label}>{c.label}</Text>
                {c.updated_by ? <Text style={s.meta}>Changed by {c.updated_by} · {String(c.updated_at).slice(0, 16).replace('T', ' ')}</Text> : <Text style={s.meta}>Default: {c.default}</Text>}
              </View>
              <Input value={values[c.key] ?? ''} editable={isSuper} onChangeText={(t: string) => setValues({ ...values, [c.key]: t })} style={{ width: 260 }} />
              {isSuper ? (
                values[c.key] !== c.value
                  ? <Btn small title={busy === c.key ? 'Saving…' : 'Save'} disabled={!!busy} onPress={() => save(c.key)} />
                  : <Badge status="active" label="saved" />
              ) : null}
            </View>
          ))}
        </Card>
      )}
    </Shell>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', flexWrap: 'wrap' },
  label: { fontSize: 13, fontWeight: '700', color: CC.navy },
  meta: { fontSize: 11, color: CC.sub, marginTop: 2 },
});
