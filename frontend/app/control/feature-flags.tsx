import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC, ApiError } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Badge, Loading, ReauthModal, ModalCard, Btn } from '../../src/control/ui';

export default function FeatureFlags() {
  const { req, reauth, mode } = useCC();
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<any>(null); // {key,label,enabled}
  const [reauthFor, setReauthFor] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setItems((await req('/feature-flags')).items); }
    catch (e: any) { setError(e.message); setItems([]); }
  }, [req]);

  useEffect(() => { load(); }, [load, mode]);

  const apply = async (key: string, enabled: boolean) => {
    setBusy(true);
    setError('');
    try {
      await req(`/feature-flags/${key}`, { method: 'PUT', body: JSON.stringify({ enabled }) });
      load();
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 428) { setReauthFor({ key, enabled }); return; }
      setError(e.message);
    } finally { setBusy(false); }
  };

  return (
    <Shell title="Feature Flags" actions={<Badge status="active" label="Live enforcement — no redeploy needed" />}>
      {error ? <Text style={{ color: CC.red, marginBottom: 8 }}>{error}</Text> : null}
      <Card style={{ backgroundColor: CC.tealSoft, borderColor: CC.teal }}>
        <Text style={{ color: CC.navy, fontSize: 13 }}>
          Flags take effect immediately across the IntroU app — Registration, Connections and Help Requests are
          enforced server-side right now. Every change is audited. Maintenance Mode and Registration require re-authentication.
        </Text>
      </Card>
      {!items ? <Loading /> : (
        <Card>
          {items.map((f) => (
            <View key={f.key} style={s.row}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.label}>{f.label}</Text>
                  {f.emergency ? <Badge status="banned" label="emergency" /> : null}
                  {f.inverted ? <Badge status="pending" label="ON = blocked" /> : null}
                </View>
                <Text style={s.desc}>{f.desc}</Text>
                {f.updated_by ? <Text style={s.meta}>Last changed by {f.updated_by} · {String(f.updated_at).slice(0, 16).replace('T', ' ')}</Text> : null}
              </View>
              <Badge status={f.inverted ? (f.enabled ? 'banned' : 'active') : (f.enabled ? 'active' : 'banned')}
                label={f.inverted ? (f.enabled ? 'ACTIVE' : 'off') : (f.enabled ? 'enabled' : 'DISABLED')} />
              <Switch value={f.enabled} disabled={busy}
                trackColor={{ false: '#CBD5E1', true: f.inverted ? CC.red : CC.teal }}
                onValueChange={(v) => setConfirm({ key: f.key, label: f.label, enabled: v, inverted: f.inverted })} />
            </View>
          ))}
        </Card>
      )}
      <ModalCard visible={!!confirm} title={`${confirm?.enabled ? (confirm?.inverted ? 'Activate' : 'Enable') : (confirm?.inverted ? 'Deactivate' : 'Disable')} ${confirm?.label}?`} onClose={() => setConfirm(null)}>
        <Text style={{ color: CC.text, marginBottom: 16 }}>
          This takes effect immediately for all app users and will be written to the audit log.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="outline" title="Cancel" onPress={() => setConfirm(null)} />
          <Btn variant={confirm?.enabled === confirm?.inverted ? 'primary' : 'danger'} title="Confirm"
            onPress={() => { const c = confirm; setConfirm(null); apply(c.key, c.enabled); }} />
        </View>
      </ModalCard>
      <ReauthModal visible={!!reauthFor} busy={busy} onCancel={() => { setReauthFor(null); setBusy(false); }}
        onSubmit={async (pw) => {
          try { await reauth(pw); const a = reauthFor; setReauthFor(null); await apply(a.key, a.enabled); }
          catch (e: any) { setError(e.message); setBusy(false); }
        }} />
    </Shell>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  label: { fontSize: 14, fontWeight: '700', color: CC.navy },
  desc: { fontSize: 12, color: CC.sub, marginTop: 2 },
  meta: { fontSize: 11, color: CC.sub, marginTop: 2, fontStyle: 'italic' },
});
