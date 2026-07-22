import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions, TextInput } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CC } from './theme';
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
        <View style={st.brandMark}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>IN</Text></View>
        <View>
          <Text style={st.brandText}>IntroU</Text>
          <Text style={st.brandSub}>Control Centre</Text>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {NAV.map((item) => {
          const active = pathname === item.path;
          return (
            <Pressable
              key={item.path}
              onPress={() => { setNavOpen(false); router.push(item.path as any); }}
              style={[st.navItem, active && st.navItemActive]}
            >
              <Ionicons name={item.icon} size={16} color={active ? CC.teal : '#9FB0CC'} />
              <Text style={[st.navLabel, active && { color: '#fff', fontWeight: '700' }]} numberOfLines={1}>{item.label}</Text>
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
              style={[st.modeBadge, { backgroundColor: mode === 'live' ? CC.red : CC.blue }]}
            >
              <View style={st.modeDot} />
              <Text style={st.modeText}>{mode === 'live' ? 'LIVE' : 'DEMO'}</Text>
              <Ionicons name="swap-horizontal" size={13} color="#fff" />
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
  sidebar: { width: 240, backgroundColor: CC.navy, paddingTop: 16 },
  sidebarOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 100, elevation: 10 },
  overlayBg: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 99 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  brandMark: { width: 34, height: 34, borderRadius: 8, backgroundColor: CC.teal, alignItems: 'center', justifyContent: 'center' },
  brandText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
  brandSub: { color: '#9FB0CC', fontSize: 11 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 9 },
  navItemActive: { backgroundColor: 'rgba(15,163,163,0.15)', borderLeftWidth: 3, borderLeftColor: CC.teal, paddingLeft: 13 },
  navLabel: { color: '#C4D0E4', fontSize: 13, flex: 1 },
  soonTag: { color: '#7C8DB0', fontSize: 9, fontWeight: '700', backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: CC.surface, borderBottomWidth: 1, borderBottomColor: CC.border, paddingHorizontal: 20, paddingVertical: 10, zIndex: 40 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 12, height: 38 },
  searchInput: { flex: 1, fontSize: 13, color: CC.text, outlineStyle: 'none' } as any,
  searchDrop: { position: 'absolute', top: 44, left: 0, right: 0, backgroundColor: CC.surface, borderRadius: 10, borderWidth: 1, borderColor: CC.border, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', elevation: 6, paddingVertical: 4 } as any,
  searchItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  searchItemText: { fontSize: 13, color: CC.text, flex: 1 },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  modeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  modeText: { color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: CC.orange, alignItems: 'center', justifyContent: 'center' },
  profileDrop: { position: 'absolute', top: 54, right: 20, backgroundColor: CC.surface, borderRadius: 10, borderWidth: 1, borderColor: CC.border, padding: 14, gap: 6, zIndex: 60, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', elevation: 6, minWidth: 220 } as any,
  content: { padding: 24, maxWidth: 1400, width: '100%', alignSelf: 'center' },
  pageHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: CC.navy },
});
