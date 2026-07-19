import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Slot, Redirect, usePathname } from 'expo-router';
import { ControlProvider, useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';

function Guard() {
  const { token, admin, booting } = useCC();
  const pathname = usePathname();

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: CC.bg }}>
        <ActivityIndicator color={CC.teal} size="large" />
      </View>
    );
  }
  const isLogin = pathname === '/control/login';
  const isChangePw = pathname === '/control/change-password';
  if (!token && !isLogin) return <Redirect href="/control/login" />;
  if (token && isLogin) return <Redirect href="/control" />;
  if (token && admin?.must_change_password && !isChangePw) return <Redirect href="/control/change-password" />;
  return <Slot />;
}

export default function ControlLayout() {
  return (
    <ControlProvider>
      <Guard />
    </ControlProvider>
  );
}
