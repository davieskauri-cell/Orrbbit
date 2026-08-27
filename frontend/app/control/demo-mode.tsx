import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Btn, Loading } from '../../src/control/ui';

export default function DemoModeControls() {
  const { req } = useCC();
  const [state, setState] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState('');

  const load = useCallback(async () => {
    try { setState(await req('/demo-mode')); } catch (e: any) { setError(e.message); setState({}); }
  }, [req]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (key: 'demo_mode_enabled' | 'store_screenshot_mode') => {
    setBusy(key); setError(''); setResult('');
    try {
      await req('/demo-mode', { method: 'PUT', body: JSON.stringify({ [key]: !state[key] }) });
      await load();
    } catch (e: any) { setError(e.message); }
    setBusy('');
  };

  const action = async (path: string, label: string) => {
    setBusy(path); setError(''); setResult('');
    try {
      await req(`/demo-mode/${path}`, { method: 'POST' });
      setResult(`${label} completed`);
      await load();
    } catch (e: any) { setError(e.message); }
    setBusy('');
  };

  if (!state) return <Shell title="Demo Mode"><Loading /></Shell>;

  return (
    <Shell title="Demo Mode">
      <Card>
        <Text style={s.title}>Environment controls</Text>
        <Text style={s.desc}>
          Demo profiles are only visible to real users while Demo Mode is enabled. Demo and real
          accounts can never contact each other, and demo activity never sends real emails or push.
        </Text>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Demo Mode</Text>
            <Text style={s.hint}>{state.demo_mode_enabled ? 'Enabled — demo profiles visible' : 'Disabled — demo data hidden from real users'}</Text>
          </View>
          <Btn
            title={busy === 'demo_mode_enabled' ? '…' : state.demo_mode_enabled ? 'Disable' : 'Enable'}
            onPress={() => toggle('demo_mode_enabled')}
            variant={state.demo_mode_enabled ? "danger" : "primary"}
          />
        </View>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Store Screenshot Mode</Text>
            <Text style={s.hint}>{state.store_screenshot_mode ? 'On — stable data, ping popups paused' : 'Off'}</Text>
          </View>
          <Btn
            title={busy === 'store_screenshot_mode' ? '…' : state.store_screenshot_mode ? 'Disable' : 'Enable'}
            onPress={() => toggle('store_screenshot_mode')}
            variant={state.store_screenshot_mode ? "danger" : "primary"}
          />
        </View>
      </Card>

      <Card>
        <Text style={s.title}>Demo data</Text>
        <Text style={s.desc}>
          {state.demo_users ?? 0} demo users · {state.demo_photos_applied ?? 0} with unique generated photos.
          Seeding is idempotent — running it again never creates duplicates. Removing demo data never
          touches real-user records.
        </Text>
        <View style={s.btnRow}>
          <Btn title={busy === 'seed' ? 'Seeding…' : 'Seed Demo Data'} onPress={() => action('seed', 'Seed')} />
          <Btn title={busy === 'reset' ? 'Resetting…' : 'Reset Demo Data'} onPress={() => action('reset', 'Reset')} />
          <Btn title={busy === 'remove' ? 'Removing…' : 'Remove Demo Data'} variant="danger" onPress={() => action('remove', 'Remove')} />
        </View>
        {!!result && <Text style={s.ok}>{result}</Text>}
        {!!error && <Text style={s.err}>{error}</Text>}
      </Card>
    </Shell>
  );
}

const s = StyleSheet.create({
  title: { color: CC.text, fontSize: 16, fontWeight: '800' },
  desc: { color: CC.sub, fontSize: 13, marginTop: 4, marginBottom: 10, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderColor: CC.border },
  label: { color: CC.text, fontSize: 14, fontWeight: '700' },
  hint: { color: CC.sub, fontSize: 12, marginTop: 2 },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  ok: { color: '#16A34A', fontSize: 13, marginTop: 10, fontWeight: '600' },
  err: { color: '#DC2626', fontSize: 13, marginTop: 10 },
});
