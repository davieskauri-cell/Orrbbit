import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Image } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useCC } from '../../src/control/ControlContext';
import { CC, CCF } from '../../src/control/theme';
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
      {/* subtle Orrbbit radar rings — restrained background decoration */}
      <Svg width={520} height={520} style={s.rings} pointerEvents="none">
        {[80, 140, 200, 260].map((r) => (
          <Circle key={r} cx={260} cy={260} r={r} stroke={CC.teal} strokeOpacity={0.08} strokeWidth={2} fill="none" />
        ))}
      </Svg>
      <View style={s.card}>
        <View style={s.brandCol}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={s.logo}
            resizeMode="contain"
            accessibilityLabel="Orrbbit logo"
          />
          <Text style={s.brand}>Orrbbit Master Dashboard</Text>
          <Text style={s.sub}>Authorised access only</Text>
        </View>
        <Text style={s.label}>Email</Text>
        <Input testID="control-login-email" placeholder="admin@orrbbit.app" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Text style={s.label}>Password</Text>
        <Input testID="control-login-password" placeholder="••••••••••" secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={submit} />
        {error ? <Text testID="control-login-error" style={s.error}>{error}</Text> : null}
        <View style={{ marginTop: 20 }}>
          <Btn testID="control-login-submit" title={busy ? 'Signing in…' : 'Sign In'} onPress={submit} disabled={busy} />
        </View>
        <Text style={s.foot}>All admin activity is logged and audited.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CC.bg, alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'hidden' },
  rings: { position: 'absolute', alignSelf: 'center' },
  card: { backgroundColor: CC.surface, borderRadius: 16, padding: 32, width: '100%', maxWidth: 420, borderWidth: 1, borderColor: CC.border, boxShadow: '0 8px 30px rgba(22,41,78,0.08)' } as any,
  brandCol: { alignItems: 'center', gap: 6, marginBottom: 24 },
  logo: { width: 64, height: 64, borderRadius: 16 },
  brand: { fontSize: 18, fontWeight: '800', color: CC.navy, fontFamily: CCF.bold, marginTop: 6 },
  sub: { fontSize: 12, color: CC.sub },
  label: { fontSize: 12, fontWeight: '700', color: CC.navy, marginTop: 14, marginBottom: 6 },
  error: { color: CC.red, fontSize: 13, marginTop: 12 },
  foot: { color: CC.sub, fontSize: 11, textAlign: 'center', marginTop: 18 },
});
