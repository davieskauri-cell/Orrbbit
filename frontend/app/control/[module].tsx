import React from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Shell from '../../src/control/Shell';
import { Card } from '../../src/control/ui';
import { CC } from '../../src/control/theme';

const PHASE_3 = ['marketing', 'content-management', 'categories', 'subscriptions', 'payments'];

export default function ComingSoon() {
  const { module } = useLocalSearchParams<{ module: string }>();
  const name = (module || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const phase = PHASE_3.includes(module || '') ? 3 : 2;
  return (
    <Shell title={name}>
      <Card style={{ alignItems: 'center', paddingVertical: 60 }}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🚧</Text>
        <Text style={{ fontSize: 17, fontWeight: '800', color: CC.navy, marginBottom: 6 }}>{name} arrives in Phase {phase}</Text>
        <Text style={{ color: CC.sub, fontSize: 13, textAlign: 'center', maxWidth: 420 }}>
          This module is on the Control Centre roadmap. Phase 1 covers Dashboard, Command Centre, Users,
          Professionals, Verification, Help Requests, Reports, Audit Logs and Admin Users.
        </Text>
        {(module === 'payments' || module === 'subscriptions') ? (
          <View style={{ marginTop: 16, backgroundColor: '#F1F5F9', borderRadius: 8, padding: 12, maxWidth: 460 }}>
            <Text style={{ color: CC.sub, fontSize: 12, textAlign: 'center' }}>
              Payment integration not configured. This module will be built as provider-agnostic,
              integration-ready infrastructure — no fabricated financial data will ever be shown in LIVE mode.
            </Text>
          </View>
        ) : null}
      </Card>
    </Shell>
  );
}
