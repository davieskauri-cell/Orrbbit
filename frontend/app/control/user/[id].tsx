import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Shell from '../../../src/control/Shell';
import { useCC, ApiError } from '../../../src/control/ControlContext';
import { CC } from '../../../src/control/theme';
import { Card, Badge, Btn, SectionTitle, Loading, EmptyText, ReauthModal, ModalCard } from '../../../src/control/ui';

const ACTIONS: { key: string; label: string; variant: any; confirm: string }[] = [
  { key: 'suspend', label: 'Suspend', variant: 'outline', confirm: 'Suspend this user? They will be hidden from the radar.' },
  { key: 'unsuspend', label: 'Unsuspend', variant: 'outline', confirm: 'Restore this user to normal status?' },
  { key: 'ban', label: 'Ban', variant: 'danger', confirm: 'Ban this user? This hides them everywhere.' },
  { key: 'force_logout', label: 'Force Logout', variant: 'outline', confirm: 'Invalidate all of this user’s sessions?' },
  { key: 'verify_email', label: 'Verify Email', variant: 'outline', confirm: 'Mark this user’s email as verified?' },
  { key: 'reset_password', label: 'Reset Password', variant: 'outline', confirm: 'Generate a temporary password for this user?' },
  { key: 'delete', label: 'Delete', variant: 'danger', confirm: 'Permanently delete this user and all their data? This cannot be undone.' },
];

export default function UserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { req, reauth, mode } = useCC();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmAction, setConfirmAction] = useState<any>(null);
  const [reauthFor, setReauthFor] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, t] = await Promise.all([req(`/users/${id}`), req(`/users/${id}/timeline`)]);
      setData(d);
      setTimeline(t.events);
    } catch (e: any) { setError(e.message); }
  }, [req, id]);

  useEffect(() => { load(); }, [load, mode]);

  const run = async (action: string) => {
    setBusy(true);
    setError('');
    try {
      const res = await req(`/users/${id}/action`, { method: 'POST', body: JSON.stringify({ action }) });
      if (action === 'delete') { router.replace('/control/users' as any); return; }
      setNotice(res.temp_password ? `Temporary password (share securely, shown once): ${res.temp_password}` : `Action "${action}" completed and audited.`);
      load();
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 428) { setReauthFor(action); return; }
      setError(e.message);
    } finally { setBusy(false); }
  };

  if (!data) return <Shell title="User">{error ? <EmptyText>{error}</EmptyText> : <Loading />}</Shell>;
  const u = data.user;
  const statusLabel = u.admin_status === 'banned' ? 'banned' : u.admin_status === 'hidden_pending_review' ? 'suspended' : 'active';

  return (
    <Shell title={u.name || 'User'} actions={<Badge status={statusLabel} />}>
      {error ? <Text style={{ color: CC.red, marginBottom: 8 }}>{error}</Text> : null}
      {notice ? <Card style={{ backgroundColor: CC.tealSoft, borderColor: CC.teal }}><Text style={{ color: CC.navy, fontSize: 13 }}>{notice}</Text></Card> : null}

      <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
        <Card style={{ flexGrow: 1, flexBasis: 320 }}>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 12 }}>
            {u.photo_url ? <Image source={{ uri: u.photo_url }} style={s.avatar} /> : <View style={[s.avatar, { backgroundColor: CC.tealSoft }]} />}
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{u.name}{u.age ? `, ${u.age}` : ''} {u.verified ? '✓' : ''}</Text>
              <Text style={s.sub}>{u.email}</Text>
              <Text style={s.sub}>{u.city}, {u.country} · {u.app_mode === 'professional' ? 'Professional mode' : 'People mode'} · plan: {u.plan || 'free'}</Text>
            </View>
          </View>
          {u.bio ? <Text style={{ fontSize: 13, color: CC.text, marginBottom: 10 }}>{u.bio}</Text> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(data.counts).map(([k, v]: any) => (
              <View key={k} style={s.countChip}>
                <Text style={{ fontWeight: '800', color: CC.navy, fontSize: 14 }}>{v}</Text>
                <Text style={{ fontSize: 10, color: CC.sub, textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</Text>
              </View>
            ))}
          </View>
          {data.professional_profile ? (
            <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: CC.border, paddingTop: 10 }}>
              <Text style={{ fontWeight: '700', color: CC.navy, fontSize: 13 }}>Professional: {data.professional_profile.profession}</Text>
              <Text style={s.sub}>{data.professional_profile.primary_category} · Verification: {data.verification?.status || 'Not submitted'}</Text>
            </View>
          ) : null}
        </Card>

        <Card style={{ flexGrow: 1, flexBasis: 300 }}>
          <SectionTitle>Admin Actions</SectionTitle>
          <Text style={{ fontSize: 12, color: CC.sub, marginBottom: 10 }}>
            Every action is written to the audit log. Ban and Delete require password re-authentication.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ACTIONS.filter((a) => (statusLabel === 'suspended' ? a.key !== 'suspend' : a.key !== 'unsuspend')).map((a) => (
              <Btn key={a.key} small variant={a.variant} title={a.label} disabled={busy} onPress={() => setConfirmAction(a)} />
            ))}
          </View>
        </Card>
      </View>

      <Card>
        <SectionTitle>User Timeline</SectionTitle>
        {!timeline ? <Loading /> : !timeline.length ? <EmptyText>No timeline events.</EmptyText> : timeline.map((e, i) => (
          <View key={i} style={s.tlRow}>
            <View style={s.tlDot} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: CC.text, fontWeight: '600' }}>{e.label}</Text>
              {e.detail ? <Text style={s.sub}>{e.detail}</Text> : null}
            </View>
            <Text style={s.sub}>{String(e.time).slice(0, 16).replace('T', ' ')}</Text>
          </View>
        ))}
      </Card>

      <ModalCard visible={!!confirmAction} title={confirmAction?.label || ''} onClose={() => setConfirmAction(null)}>
        <Text style={{ color: CC.text, marginBottom: 16 }}>{confirmAction?.confirm}</Text>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="outline" title="Cancel" onPress={() => setConfirmAction(null)} />
          <Btn variant={confirmAction?.variant === 'danger' ? 'danger' : 'primary'} title="Confirm"
            onPress={() => { const a = confirmAction.key; setConfirmAction(null); run(a); }} />
        </View>
      </ModalCard>

      <ReauthModal visible={!!reauthFor} busy={busy} onCancel={() => setReauthFor(null)}
        onSubmit={async (pw) => {
          setBusy(true);
          try { await reauth(pw); const a = reauthFor; setReauthFor(null); await run(a); }
          catch (e: any) { setError(e.message); setBusy(false); }
        }} />
    </Shell>
  );
}

const s = StyleSheet.create({
  avatar: { width: 64, height: 64, borderRadius: 32 },
  name: { fontSize: 17, fontWeight: '800', color: CC.navy },
  sub: { fontSize: 12, color: CC.sub, marginTop: 2 },
  countChip: { borderWidth: 1, borderColor: CC.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 76 },
  tlRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tlDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: CC.teal },
});
