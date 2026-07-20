import React, { useEffect, useState, useCallback } from 'react';
import { View, Text } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Input, Btn, Loading, SectionTitle, Chip, Badge } from '../../src/control/ui';

export default function ContentManagement() {
  const { req } = useCC();
  const [items, setItems] = useState<any[] | null>(null);
  const [active, setActive] = useState('community_guidelines');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await req('/content/pages');
      setItems(d.items);
      const cur = d.items.find((i: any) => i.key === active);
      setBody(cur?.body || '');
    } catch (e: any) { setError(e.message); setItems([]); }
  }, [req, active]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      await req(`/content/pages/${active}`, { method: 'PUT', body: JSON.stringify({ body }) });
      setNotice('Saved and audited.');
      load();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const current = items?.find((i) => i.key === active);
  return (
    <Shell title="Content Management">
      {error ? <Text style={{ color: CC.red, marginBottom: 8 }}>{error}</Text> : null}
      {notice ? <Card style={{ backgroundColor: CC.tealSoft, borderColor: CC.teal }}><Text style={{ color: CC.navy, fontSize: 13 }}>{notice}</Text></Card> : null}
      {!items ? <Loading /> : (
        <>
          <Card>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {items.map((i) => (
                <Chip key={i.key} label={`${i.title}${i.body ? ' ✓' : ''}`} active={active === i.key}
                  onPress={() => { setActive(i.key); setBody(i.body || ''); setNotice(''); }} />
              ))}
            </View>
          </Card>
          <Card>
            <SectionTitle right={current?.updated_by ? <Badge status="active" label={`by ${current.updated_by}`} /> : undefined}>
              {current?.title}
            </SectionTitle>
            <Input multiline value={body} onChangeText={setBody} placeholder={`Write the ${current?.title} content here (markdown supported in-app)…`}
              style={{ minHeight: 320, textAlignVertical: 'top' }} />
            <View style={{ marginTop: 12, alignItems: 'flex-start' }}>
              <Btn title={busy ? 'Saving…' : 'Save content'} disabled={busy} onPress={save} />
            </View>
          </Card>
        </>
      )}
    </Shell>
  );
}
