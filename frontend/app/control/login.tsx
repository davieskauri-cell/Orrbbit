import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Input, Btn } from '../../src/control/ui';

export default function ControlLogin() {
  const { login } = useCC();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || !password || busy) return;
    setBusy(true);
    setError('');
    try {
      const admin = await login(email.trim(), password);
      router.replace(admin.must_change_password ? ('/control/change-password' as any) : ('/control' as any));
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.root}>
      <View style={s.card}>
        <View style={s.brandRow}>
          <View style={s.mark}><Text style={{ color: '#fff', fontWeight: '900' }}>IN</Text></View>
          <View>
            <Text style={s.brand}>IntroU Control Centre</Text>
            <Text style={s.sub}>Administrator access only</Text>
          </View>
        </View>
        <Text style={s.label}>Email</Text>
        <Input placeholder="admin@introu.app" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Text style={s.label}>Password</Text>
        <Input placeholder="••••••••••" secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={submit} />
        {error ? <Text style={s.error}>{error}</Text> : null}
        <View style={{ marginTop: 20 }}>
          <Btn title={busy ? 'Signing in…' : 'Sign in'} onPress={submit} disabled={busy} />
        </View>
        <Text style={s.foot}>All admin activity is logged and audited.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CC.navy, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: CC.surface, borderRadius: 16, padding: 32, width: '100%', maxWidth: 420 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  mark: { width: 42, height: 42, borderRadius: 10, backgroundColor: CC.teal, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 18, fontWeight: '800', color: CC.navy },
  sub: { fontSize: 12, color: CC.sub },
  label: { fontSize: 12, fontWeight: '700', color: CC.navy, marginTop: 14, marginBottom: 6 },
  error: { color: CC.red, fontSize: 13, marginTop: 12 },
  foot: { color: CC.sub, fontSize: 11, textAlign: 'center', marginTop: 18 },
});
