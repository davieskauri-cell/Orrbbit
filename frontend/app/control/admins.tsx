import React, { useEffect, useState, useCallback } from 'react';
import { View, Text } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC, ApiError } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Input, Table, Tr, Td, Badge, Btn, Loading, EmptyText, SectionTitle, Chip, ReauthModal } from '../../src/control/ui';
import { fmtDT } from '../../src/control/datetime';

const ROLES = ['super_admin', 'operations', 'verification', 'support', 'moderation', 'marketing', 'finance', 'analytics'];

export default function Admins() {
  const { req, reauth, admin } = useCC();
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('support');
  const [showReauth, setShowReauth] = useState(false);
  const [busy, setBusy] = useState(false);

  const isSuper = admin?.role === 'super_admin';

  const load = useCallback(async () => {
    try { setItems((await req('/admins')).items); setError(''); }
    catch (e: any) { setError(e.message); setItems([]); }
  }, [req]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await req('/admins', { method: 'POST', body: JSON.stringify({ email: email.trim(), password, role }) });
      setNotice(`Admin ${email.trim()} created with role "${role}". They must change the temporary password on first login.`);
      setEmail('');
      setPassword('');
      load();
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 428) { setShowReauth(true); return; }
      setError(e.message);
    } finally { setBusy(false); }
  };

  return (
    <Shell title="Admin Users">
      {error ? <Text style={{ color: CC.red, marginBottom: 8 }}>{error}</Text> : null}
      {notice ? <Card style={{ backgroundColor: CC.tealSoft, borderColor: CC.teal }}><Text style={{ color: CC.navy, fontSize: 13 }}>{notice}</Text></Card> : null}
      {!isSuper ? <Card><EmptyText>Only Super Admins can manage admin users.</EmptyText></Card> : (
        <>
          <Card>
            <SectionTitle>Create admin</SectionTitle>
            <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <Input placeholder="Email" autoCapitalize="none" value={email} onChangeText={setEmail} style={{ flex: 1, minWidth: 200 }} />
              <Input placeholder="Temporary password (min 10 chars)" secureTextEntry value={password} onChangeText={setPassword} style={{ flex: 1, minWidth: 200 }} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {ROLES.map((r) => <Chip key={r} label={r.replace('_', ' ')} active={role === r} onPress={() => setRole(r)} />)}
            </View>
            <View style={{ marginTop: 12, alignItems: 'flex-start' }}>
              <Btn title={busy ? 'Creating…' : 'Create admin (requires re-auth)'} disabled={busy || !email || password.length < 10} onPress={create} />
            </View>
          </Card>
          {!items ? <Loading /> : (
            <Card>
              <SectionTitle>All administrators</SectionTitle>
              <Table columns={['Email', 'Role', 'Status', 'Password', 'Last login', 'Created']} widths={[1.8, 1, 0.8, 1, 1.1, 1]}>
                {items.map((a: any) => (
                  <Tr key={a.id}>
                    <Td flex={1.8}>{a.email}</Td>
                    <Td><Badge status="actioned" label={a.role.replace('_', ' ')} /></Td>
                    <Td flex={0.8}><Badge status={a.is_active ? 'active' : 'suspended'} label={a.is_active ? 'active' : 'disabled'} /></Td>
                    <Td><Badge status={a.must_change_password ? 'pending' : 'active'} label={a.must_change_password ? 'change required' : 'set'} /></Td>
                    <Td flex={1.1}>{a.last_login_at ? fmtDT(String(a.last_login_at)) : 'Never'}</Td>
                    <Td>{fmtDT(String(a.created_at || ''), true)}</Td>
                  </Tr>
                ))}
              </Table>
            </Card>
          )}
        </>
      )}
      <ReauthModal visible={showReauth} busy={busy} onCancel={() => { setShowReauth(false); setBusy(false); }}
        onSubmit={async (pw) => {
          try { await reauth(pw); setShowReauth(false); await create(); }
          catch (e: any) { setError(e.message); setBusy(false); }
        }} />
    </Shell>
  );
}
