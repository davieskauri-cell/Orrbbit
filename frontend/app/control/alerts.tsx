import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Badge, Btn, Loading, EmptyText, ErrorState } from '../../src/control/ui';

const ICONS: Record<string, string> = {
  verification_review: '🛡️', annual_review_due: '📅', more_info_requested: '📨',
  report_moderation: '🚩', email_provider: '✉️',
};

export default function ControlAlerts() {
  const { req, mode } = useCC();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = useCallback(async () => {
    setError(null);
    try { setData(await req('/notifications-centre')); }
    catch (e: any) { setError(e.message || 'Unable to load production data.'); }
  }, [req]);

  useEffect(() => { setData(null); load(); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const markRead = async (ids?: string[]) => {
    try {
      await req('/notifications-centre/read', { method: 'POST', body: JSON.stringify(ids ? { ids } : { all: true }) });
      load();
    } catch (e: any) { setError(e.message); }
  };

  const open = (n: any) => {
    if (!n.read) markRead([n.id]);
    const m = n.link?.module;
    if (m === 'verifications') router.push('/control/verifications' as any);
    else if (m === 'reports') router.push('/control/reports' as any);
    else if (m === 'emails') router.push('/control/emails' as any);
  };

  const items = (data?.items || []).filter((n: any) => (filter === 'unread' ? !n.read : true));

  return (
    <Shell title="Notifications">
      {error ? <Card><ErrorState message={error} onRetry={load} /></Card> : !data ? <Loading /> : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <Badge label={`${data.unread} unread`} tone={data.unread ? 'orange' : 'green'} />
            <Pressable onPress={() => setFilter(filter === 'all' ? 'unread' : 'all')} style={{ paddingVertical: 4, paddingHorizontal: 10 }}>
              <Text style={{ color: CC.teal, fontWeight: '800', fontSize: 12 }}>{filter === 'all' ? 'Show unread only' : 'Show all'}</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            {data.unread > 0 && <Btn small variant="outline" title="Mark all as read" onPress={() => markRead()} />}
          </View>
          {!items.length ? (
            <Card><EmptyText>{filter === 'unread' ? 'No unread notifications.' : 'No notifications — nothing requires attention right now.'}</EmptyText></Card>
          ) : items.map((n: any) => (
            <Pressable key={n.id} onPress={() => open(n)} testID={`notif-${n.id}`}>
              <Card style={{ marginBottom: 10, borderLeftWidth: 3, borderLeftColor: n.read ? CC.border : CC.orange }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <Text style={{ fontSize: 18 }}>{ICONS[n.type] || '🔔'}</Text>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={{ fontWeight: n.read ? '600' : '800', color: CC.navy, fontSize: 14 }}>{n.title}</Text>
                    <Text style={{ color: CC.sub, fontSize: 12 }} numberOfLines={2}>{n.desc}</Text>
                    <Text style={{ color: CC.sub, fontSize: 11 }}>{(n.at || '').slice(0, 16).replace('T', ' ')} · {n.status} · {n.action}</Text>
                  </View>
                  {!n.read && (
                    <Pressable onPress={() => markRead([n.id])} hitSlop={8}>
                      <Text style={{ color: CC.teal, fontSize: 11, fontWeight: '800' }}>MARK READ</Text>
                    </Pressable>
                  )}
                </View>
              </Card>
            </Pressable>
          ))}
        </>
      )}
    </Shell>
  );
}
