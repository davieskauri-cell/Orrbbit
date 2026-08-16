import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions, TextInput, Image } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CC, CCF } from './theme';
import { useCC } from './ControlContext';
import { ModalCard, Btn, Badge } from './ui';

const NAV: { label: string; path: string; icon: any; soon?: number }[] = [
  { label: 'Dashboard', path: '/control', icon: 'grid-outline' },
  { label: 'Command Centre', path: '/control/command-centre', icon: 'pulse-outline' },
  { label: 'Users', path: '/control/users', icon: 'people-outline' },
  { label: 'Professionals', path: '/control/professionals', icon: 'briefcase-outline' },
  { label: 'Professional Verification', path: '/control/verifications', icon: 'shield-checkmark-outline' },
  { label: 'Help Requests', path: '/control/help-requests', icon: 'hand-left-outline' },
  { label: 'People Radar', path: '/control/people-radar', icon: 'locate-outline' },
  { label: 'Professional Radar', path: '/control/professional-radar', icon: 'navigate-outline' },
  { label: 'Connections', path: '/control/connections', icon: 'git-network-outline' },
  { label: 'Chats', path: '/control/chats', icon: 'chatbubbles-outline' },
  { label: 'Reports', path: '/control/reports', icon: 'flag-outline' },
  { label: 'Notifications', path: '/control/notifications', icon: 'notifications-outline' },
  { label: 'Emails', path: '/control/emails', icon: 'mail-outline' },
  { label: 'Analytics', path: '/control/analytics', icon: 'bar-chart-outline' },
  { label: 'AI Insights', path: '/control/ai-insights', icon: 'sparkles-outline' },
  { label: 'Marketing', path: '/control/marketing', icon: 'megaphone-outline' },
  { label: 'Content Management', path: '/control/content-management', icon: 'document-text-outline' },
  { label: 'Categories', path: '/control/categories', icon: 'pricetags-outline' },
  { label: 'Subscriptions', path: '/control/subscriptions', icon: 'card-outline' },
  { label: 'Payments', path: '/control/payments', icon: 'cash-outline' },
  { label: 'Feature Flags', path: '/control/feature-flags', icon: 'toggle-outline' },
  { label: 'System Health', path: '/control/system-health', icon: 'heart-outline' },
  { label: 'Audit Logs', path: '/control/audit-logs', icon: 'receipt-outline' },
  { label: 'Admin Users', path: '/control/admins', icon: 'key-outline' },
  { label: 'Database Viewer', path: '/control/database-viewer', icon: 'server-outline' },
  { label: 'Exports', path: '/control/exports', icon: 'download-outline' },
  { label: 'Backups', path: '/control/backups', icon: 'cloud-upload-outline' },
  { label: 'Emergency Controls', path: '/control/emergency-controls', icon: 'warning-outline' },
  { label: 'Demo Mode', path: '/control/demo-mode', icon: 'flask-outline' },
  { label: 'Settings', path: '/control/settings', icon: 'settings-outline' },
];

function GlobalSearch() {
  const { req, mode } = useCC();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any>(null);
  const timer = useRef<any>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        setResults(await req(`/search?q=${encodeURIComponent(q.trim())}`));
      } catch {}
    }, 350);
  }, [q, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (path: string) => {
    setQ('');
    setResults(null);
    router.push(path as any);
  };

  const has = results && (results.users?.length || results.professionals?.length || results.help_requests?.length || results.reports?.length);
  return (
    <View style={{ flex: 1, maxWidth: 420, zIndex: 50 }}>
      <View style={st.searchBox}>
        <Ionicons name="search" size={16} color={CC.sub} />
        <TextInput
          style={st.searchInput}
          placeholder="Search users, professionals, requests…"
          placeholderTextColor={CC.sub}
          value={q}
          onChangeText={setQ}
        />
      </View>
      {results ? (
        <View style={st.searchDrop}>
          {!has ? <Text style={{ color: CC.sub, padding: 10, fontSize: 13 }}>No results</Text> : null}
          {results.users?.map((u: any) => (
            <Pressable key={u.id} style={st.searchItem} onPress={() => go(`/control/user/${u.id}`)}>
              <Ionicons name="person-outline" size={14} color={CC.teal} />
              <Text style={st.searchItemText}>{u.name} <Text style={{ color: CC.sub }}>· {u.email}</Text></Text>
            </Pressable>
          ))}
          {results.professionals?.map((p: any) => (
            <Pressable key={p.user_id} style={st.searchItem} onPress={() => go(`/control/user/${p.user_id}`)}>
              <Ionicons name="briefcase-outline" size={14} color={CC.teal} />
              <Text style={st.searchItemText}>{p.name} <Text style={{ color: CC.sub }}>· {p.profession}</Text></Text>
            </Pressable>
          ))}
          {results.help_requests?.map((r: any) => (
            <Pressable key={r.id} style={st.searchItem} onPress={() => go('/control/help-requests')}>
              <Ionicons name="hand-left-outline" size={14} color={CC.teal} />
              <Text style={st.searchItemText}>{r.public_summary} <Text style={{ color: CC.sub }}>· {r.category}</Text></Text>
            </Pressable>
          ))}
          {results.reports?.map((r: any) => (
            <Pressable key={r.id} style={st.searchItem} onPress={() => go('/control/reports')}>
              <Ionicons name="flag-outline" size={14} color={CC.red} />
              <Text style={st.searchItemText}>Report · {r.reason}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function Shell({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const compact = width < 1000;
  const [navOpen, setNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { admin, logout, mode, setMode } = useCC();

  const sidebar = (
    <View style={[st.sidebar, compact && st.sidebarOverlay]}>
      <View style={st.brand}>
        <Image
          source={require('../../assets/images/logo.png')}
          style={st.brandLogo}
          resizeMode="contain"
          accessibilityLabel="Orrbbit logo"
        />
        <View>
          <Text style={st.brandText}>Orrbbit</Text>
          <Text style={st.brandSub}>Control Centre</Text>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 8 }}>
        {NAV.map((item) => {
          const active = pathname === item.path;
          return (
            <Pressable
              key={item.path}
              onPress={() => { setNavOpen(false); router.push(item.path as any); }}
              style={({ hovered }: any) => [st.navItem, hovered && !active && st.navItemHover, active && st.navItemActive]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <Ionicons name={item.icon} size={16} color={active ? CC.tealDark : CC.sub} />
              <Text style={[st.navLabel, active && st.navLabelActive]} numberOfLines={1}>{item.label}</Text>
              {item.soon ? <Text style={st.soonTag}>P{item.soon}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={st.root}>
      {!compact ? sidebar : null}
      {compact && navOpen ? (
        <Pressable style={st.overlayBg} onPress={() => setNavOpen(false)}>
          {sidebar}
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <View style={st.topbar}>
          {compact ? (
            <Pressable onPress={() => setNavOpen(true)} style={{ padding: 6 }}>
              <Ionicons name="menu" size={22} color={CC.navy} />
            </Pressable>
          ) : null}
          <GlobalSearch />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable
              onPress={() => (mode === 'live' ? setMode('demo') : setConfirmLive(true))}
              style={[st.modeBadge, mode === 'live' ? st.modeLive : st.modeDemo]}
              accessibilityRole="button"
              accessibilityLabel={mode === 'live' ? 'Environment: LIVE production. Switch to demo.' : 'Environment: DEMO. Switch to live.'}
            >
              <View style={[st.modeDot, { backgroundColor: mode === 'live' ? CC.green : CC.tealDark }]} />
              <Text style={[st.modeText, { color: mode === 'live' ? CC.green : CC.tealDark }]}>
                {mode === 'live' ? 'LIVE · PRODUCTION' : 'DEMO'}
              </Text>
              <Ionicons name="swap-horizontal" size={13} color={mode === 'live' ? CC.green : CC.tealDark} />
            </Pressable>
            <Pressable onPress={() => router.push('/control' as any)} style={{ padding: 4 }}>
              <Ionicons name="notifications-outline" size={20} color={CC.navy} />
            </Pressable>
            <Pressable onPress={() => setProfileOpen(!profileOpen)} style={st.avatar}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{(admin?.email || 'A')[0].toUpperCase()}</Text>
            </Pressable>
          </View>
        </View>
        {profileOpen ? (
          <View style={st.profileDrop}>
            <Text style={{ fontWeight: '700', color: CC.navy, fontSize: 13 }}>{admin?.email}</Text>
            <Badge status="active" label={admin?.role?.replace('_', ' ')} />
            <Text style={{ color: CC.sub, fontSize: 11 }}>Environment: {mode === 'live' ? 'LIVE · Production' : 'DEMO · Isolated data'}</Text>
            <Pressable onPress={() => { setProfileOpen(false); router.push('/control/change-password' as any); }} style={{ paddingVertical: 6 }}>
              <Text style={{ color: CC.teal, fontSize: 13, fontWeight: '600' }}>Change password</Text>
            </Pressable>
            <Pressable onPress={async () => { setProfileOpen(false); await logout(); router.replace('/control/login' as any); }} style={{ paddingVertical: 6 }}>
              <Text style={{ color: CC.red, fontSize: 13, fontWeight: '600' }}>Sign out</Text>
            </Pressable>
          </View>
        ) : null}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={st.content}>
          <View style={st.pageHead}>
            <Text style={st.pageTitle}>{title}</Text>
            {actions}
          </View>
          {children}
        </ScrollView>
      </View>
      <ModalCard visible={confirmLive} title="Switch to LIVE mode?" onClose={() => setConfirmLive(false)}>
        <Text style={{ color: CC.text, marginBottom: 8 }}>
          LIVE mode connects directly to production data. Every action affects real users and is fully audited.
        </Text>
        <Text style={{ color: CC.sub, marginBottom: 16, fontSize: 13 }}>
          DEMO mode uses isolated seeded data and never touches production.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="outline" title="Stay in DEMO" onPress={() => setConfirmLive(false)} />
          <Btn variant="danger" title="Enter LIVE mode" onPress={() => { setMode('live'); setConfirmLive(false); }} />
        </View>
      </ModalCard>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: CC.bg },
  sidebar: { width: 240, backgroundColor: CC.surface, paddingTop: 16, borderRightWidth: 1, borderRightColor: CC.border },
  sidebarOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 100, elevation: 10 },
  overlayBg: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15,29,58,0.4)', zIndex: 99 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: CC.border },
  brandLogo: { width: 36, height: 36, borderRadius: 9 },
  brandText: { color: CC.navy, fontWeight: '900', fontSize: 15, letterSpacing: 0.5, fontFamily: CCF.bold },
  brandSub: { color: CC.sub, fontSize: 11, fontFamily: CCF.med },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, marginBottom: 1 },
  navItemHover: { backgroundColor: '#F1F8F8' },
  navItemActive: { backgroundColor: CC.tealSoft },
  navLabel: { color: CC.text, fontSize: 13, flex: 1 },
  navLabelActive: { color: CC.navy, fontWeight: '700' },
  soonTag: { color: CC.sub, fontSize: 9, fontWeight: '700', backgroundColor: '#F1F5F9', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: CC.surface, borderBottomWidth: 1, borderBottomColor: CC.border, paddingHorizontal: 20, paddingVertical: 10, zIndex: 40 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 12, height: 38 },
  searchInput: { flex: 1, fontSize: 13, color: CC.text, outlineStyle: 'none' } as any,
  searchDrop: { position: 'absolute', top: 44, left: 0, right: 0, backgroundColor: CC.surface, borderRadius: 10, borderWidth: 1, borderColor: CC.border, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', elevation: 6, paddingVertical: 4 } as any,
  searchItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  searchItemText: { fontSize: 13, color: CC.text, flex: 1 },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  modeLive: { backgroundColor: CC.greenSoft, borderColor: CC.green },
  modeDemo: { backgroundColor: CC.tealSoft, borderColor: CC.teal },
  modeDot: { width: 7, height: 7, borderRadius: 4 },
  modeText: { fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: CC.orange, alignItems: 'center', justifyContent: 'center' },
  profileDrop: { position: 'absolute', top: 54, right: 20, backgroundColor: CC.surface, borderRadius: 10, borderWidth: 1, borderColor: CC.border, padding: 14, gap: 6, zIndex: 60, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', elevation: 6, minWidth: 220 } as any,
  content: { padding: 24, maxWidth: 1400, width: '100%', alignSelf: 'center' },
  pageHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: CC.navy, fontFamily: CCF.bold },
});
