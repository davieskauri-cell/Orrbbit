import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC, ApiError } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Badge, Btn, Loading, ReauthModal, ModalCard } from '../../src/control/ui';

const CONTROLS: { key: string; label: string; desc: string; inverted?: boolean }[] = [
  { key: 'maintenance_mode', label: 'Maintenance Mode', desc: 'Blocks all gated actions app-wide with a maintenance message', inverted: true },
  { key: 'registration', label: 'Disable Registration', desc: 'Stop all new user sign-ups immediately' },
  { key: 'messaging', label: 'Disable Messaging', desc: 'Turn off in-app messaging (when launched)' },
  { key: 'connections', label: 'Disable Connections', desc: 'Stop all new connection requests' },
  { key: 'help_requests', label: 'Disable Help Requests', desc: 'Stop new professional help requests being posted' },
  { key: 'push_notifications', label: 'Disable Push Notifications', desc: 'Stop all outbound push (currently mocked)' },
  { key: 'verification', label: 'Disable Professional Verification', desc: 'Pause credential submissions and reviews' },
];

export default function EmergencyControls() {
  const { req, reauth, admin } = useCC();
  const [flags, setFlags] = useState<Record<string, boolean> | null>(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<any>(null);
  const [reauthFor, setReauthFor] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await req('/feature-flags');
      const map: Record<string, boolean> = {};
      d.items.forEach((f: any) => { map[f.key] = f.enabled; });
      setFlags(map);
    } catch (e: any) { setError(e.message); setFlags({}); }
  }, [req]);

  useEffect(() => { load(); }, [load]);

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

  // for inverted (maintenance): triggered = enabled. For others: triggered = !enabled.
  const isTriggered = (c: any) => (flags ? (c.inverted ? !!flags[c.key] : flags[c.key] === false) : false);

  return (
    <Shell title="Emergency Controls" actions={<Badge status="banned" label={`Signed in as ${admin?.role?.replace('_', ' ')}`} />}>
      {error ? <Text style={{ color: CC.red, marginBottom: 8 }}>{error}</Text> : null}
      <Card style={{ backgroundColor: CC.redSoft, borderColor: CC.red }}>
        <Text style={{ color: CC.navy, fontSize: 13, fontWeight: '600' }}>
          ⚠️ One-click platform kill-switches. Changes apply to the live app instantly and are fully audited.
          Confirmation is required for every action; Maintenance Mode and Registration also require password re-authentication.
        </Text>
      </Card>
      {!flags ? <Loading /> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {CONTROLS.map((c) => {
            const triggered = isTriggered(c);
            return (
              <Card key={c.key} style={[s.ctl, triggered && { borderColor: CC.red, borderWidth: 2 }, { marginBottom: 0 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={s.label}>{c.label}</Text>
                  <Badge status={triggered ? 'banned' : 'active'} label={triggered ? 'TRIGGERED' : 'normal'} />
                </View>
                <Text style={s.desc}>{c.desc}</Text>
                <View style={{ marginTop: 12, alignItems: 'flex-start' }}>
                  <Btn small variant={triggered ? 'teal' : 'danger'}
                    title={triggered ? (c.inverted ? 'End maintenance' : 'Re-enable') : (c.inverted ? 'Activate' : 'Disable now')}
                    disabled={busy}
                    onPress={() => setConfirm({ ...c, next: !flags[c.key], triggered })} />
                </View>
              </Card>
            );
          })}
        </View>
      )}
      <ModalCard visible={!!confirm} title={`Confirm: ${confirm?.label}`} onClose={() => setConfirm(null)}>
        <Text style={{ color: CC.text, marginBottom: 16 }}>
          {confirm?.triggered
            ? 'This will restore normal operation for all users immediately.'
            : 'This will take effect for ALL app users immediately. Are you sure?'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="outline" title="Cancel" onPress={() => setConfirm(null)} />
          <Btn variant={confirm?.triggered ? 'teal' : 'danger'} title="Yes, do it"
            onPress={() => {
              const c = confirm; setConfirm(null);
              apply(c.key, c.next);
            }} />
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
  ctl: { flexGrow: 1, flexBasis: 300 },
  label: { fontSize: 14, fontWeight: '800', color: CC.navy },
  desc: { fontSize: 12, color: CC.sub },
});
