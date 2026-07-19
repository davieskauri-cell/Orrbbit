import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Input, Btn } from '../../src/control/ui';

export default function ChangePassword() {
  const { changePassword, admin } = useCC();
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const forced = admin?.must_change_password;

  const submit = async () => {
    setError('');
    if (next.length < 10) return setError('New password must be at least 10 characters.');
    if (next !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await changePassword(current, next);
      router.replace('/control' as any);
    } catch (e: any) {
      setError(e.message || 'Failed to change password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.root}>
      <View style={s.card}>
        <Text style={s.title}>{forced ? 'Set a new password' : 'Change password'}</Text>
        {forced ? (
          <Text style={s.sub}>Your temporary password must be changed before you can use the Control Centre.</Text>
        ) : null}
        <Text style={s.label}>Current password</Text>
        <Input secureTextEntry value={current} onChangeText={setCurrent} placeholder="Current password" />
        <Text style={s.label}>New password (min 10 characters)</Text>
        <Input secureTextEntry value={next} onChangeText={setNext} placeholder="New password" />
        <Text style={s.label}>Confirm new password</Text>
        <Input secureTextEntry value={confirm} onChangeText={setConfirm} placeholder="Confirm new password" />
        {error ? <Text style={s.error}>{error}</Text> : null}
        <View style={{ marginTop: 20, gap: 8 }}>
          <Btn title={busy ? 'Saving…' : 'Update password'} onPress={submit} disabled={busy} />
          {!forced ? <Btn variant="outline" title="Cancel" onPress={() => router.back()} /> : null}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CC.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: CC.surface, borderRadius: 16, padding: 32, width: '100%', maxWidth: 440, borderWidth: 1, borderColor: CC.border },
  title: { fontSize: 20, fontWeight: '800', color: CC.navy, marginBottom: 8 },
  sub: { fontSize: 13, color: CC.sub, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', color: CC.navy, marginTop: 14, marginBottom: 6 },
  error: { color: CC.red, fontSize: 13, marginTop: 12 },
});
