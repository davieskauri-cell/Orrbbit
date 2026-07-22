import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Btn, Badge, SectionTitle } from '../../src/control/ui';

const ENTITIES = [
  { key: 'users', label: 'Users', desc: 'All user profiles (passwords excluded)' },
  { key: 'professionals', label: 'Professionals', desc: 'Professional profiles with categories and availability' },
  { key: 'reports', label: 'Reports', desc: 'Moderation reports with status and actions taken' },
  { key: 'analytics', label: 'Analytics', desc: 'Current platform metrics snapshot' },
  { key: 'revenue', label: 'Revenue', desc: 'Payments (DEMO seeded data only — LIVE shows not configured)' },
  { key: 'subscriptions', label: 'Subscriptions', desc: 'Subscriptions (DEMO seeded data only — LIVE shows not configured)' },
];
const FORMATS = [
  { key: 'csv', label: 'CSV' }, { key: 'xlsx', label: 'Excel' }, { key: 'pdf', label: 'PDF' },
];

export default function Exports() {
  const { download, mode } = useCC();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const run = async (entity: string, format: string) => {
    setBusy(`${entity}-${format}`);
    setError('');
    try {
      const ext = format === 'xlsx' ? 'xlsx' : format;
      await download(`/exports/${entity}?format=${format}`, `introyu-${entity}-${mode}.${ext}`);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(''); }
  };

  return (
    <Shell title="Exports" actions={<Badge status={mode === 'live' ? 'banned' : 'new'} label={`Exporting ${mode.toUpperCase()} data`} />}>
      {error ? <Text style={{ color: CC.red, marginBottom: 8 }}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        {ENTITIES.map((e) => (
          <Card key={e.key} style={{ flexGrow: 1, flexBasis: 320, marginBottom: 0 }}>
            <SectionTitle>{e.label}</SectionTitle>
            <Text style={s.desc}>{e.desc}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {FORMATS.map((f) => (
                <Btn key={f.key} small variant={f.key === 'csv' ? 'teal' : 'outline'}
                  title={busy === `${e.key}-${f.key}` ? '…' : f.label}
                  disabled={!!busy}
                  onPress={() => run(e.key, f.key)} />
              ))}
            </View>
          </Card>
        ))}
      </View>
      <Card style={{ marginTop: 16 }}>
        <Text style={s.desc}>Every export is written to the audit log with the format and row count. Sensitive fields (passwords, document files) are never included.</Text>
      </Card>
    </Shell>
  );
}

const s = StyleSheet.create({
  desc: { fontSize: 12, color: CC.sub },
});
