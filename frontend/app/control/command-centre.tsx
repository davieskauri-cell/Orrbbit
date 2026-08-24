import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Chip, Badge, Loading, EmptyText, ErrorState, Btn } from '../../src/control/ui';

const CATEGORIES = [
  { key: '', label: 'All' }, { key: 'users', label: 'Users' }, { key: 'professionals', label: 'Professionals' },
  { key: 'verification', label: 'Verification' }, { key: 'reports', label: 'Reports' },
  { key: 'connections', label: 'Connections' }, { key: 'admin', label: 'Admin Actions' },
];
const WINDOWS = [
  { key: 'live', label: 'Live' }, { key: 'today', label: 'Today' }, { key: '7d', label: '7 Days' }, { key: '30d', label: '30 Days' },
];

export default function CommandCentre() {
  const { req, mode } = useCC();
  const router = useRouter();
  const [category, setCategory] = useState('');
  const [window_, setWindow] = useState('7d');
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<any>(null);

  const load = useCallback(async () => {
    try {
      const d = await req(`/activity?window=${window_}${category ? `&category=${category}` : ''}`);
      setItems(d.items);
      setError(null);
    } catch (e: any) { setError(e.message || 'Unable to load production data.'); }
  }, [req, window_, category]);

  useEffect(() => {
    setItems(null);
    load();
    if (timer.current) clearInterval(timer.current);
    if (window_ === 'live') timer.current = setInterval(load, 10000);
    return () => timer.current && clearInterval(timer.current);
  }, [load, mode]);

  const openLink = (link: any) => {
    if (!link) return;
    if (link.module === 'users') router.push(`/control/user/${link.id}` as any);
    else router.push(`/control/${link.module}` as any);
  };

  return (
    <Shell title="Command Centre" actions={window_ === 'live' ? <Badge status="active" label="Auto-refreshing" /> : undefined}>
      <Card>
        <View style={s.filters}>
          {CATEGORIES.map((c) => (
            <Chip key={c.key} label={c.label} active={category === c.key} onPress={() => setCategory(c.key)} />
          ))}
        </View>
        <View style={[s.filters, { marginTop: 8 }]}>
          {WINDOWS.map((w) => (
            <Chip key={w.key} label={w.label} active={window_ === w.key} onPress={() => setWindow(w.key)} />
          ))}
        </View>
      </Card>
      <Card>
        {error ? <ErrorState message={error} onRetry={load} /> : !items ? <Loading /> : !items.length ? <EmptyText>No activity in this window.</EmptyText> : (
          items.map((it, i) => (
            <View key={i} style={s.row}>
              <View style={[s.dot, { backgroundColor: it.category === 'reports' ? CC.red : it.category === 'verification' ? CC.amber : it.category === 'admin' ? CC.navy : CC.teal }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.title} numberOfLines={1}>
                  <Text style={{ fontWeight: '700' }}>{it.name || 'System'}</Text> — {String(it.type).replace(/_/g, ' ')}
                  {it.extra ? ` (${it.extra})` : ''}
                </Text>
                <Text style={s.sub}>
                  {it.category}{it.location ? ` · ${it.location}` : ''} · {String(it.time).slice(0, 16).replace('T', ' ')}
                </Text>
              </View>
              {it.status ? <Badge status={it.status} /> : null}
              {it.link ? <Btn small variant="ghost" title="Open" onPress={() => openLink(it.link)} /> : null}
            </View>
          ))
        )}
      </Card>
    </Shell>
  );
}

const s = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 13, color: CC.text },
  sub: { fontSize: 11, color: CC.sub, marginTop: 2, textTransform: 'capitalize' },
});
