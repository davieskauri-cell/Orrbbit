import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Chip, Badge, Loading, EmptyText, ErrorState, ModalCard, SectionTitle } from '../../src/control/ui';
import { fmtDT } from '../../src/control/datetime';

const TABS = [
  { key: '', label: 'All' }, { key: 'active', label: 'Active' },
  { key: 'cancelled', label: 'Cancelled' }, { key: 'completed', label: 'Completed' },
];

const badgeFor = (st: string) =>
  st === 'cancelled' ? { status: 'banned', label: 'Cancelled' }
    : st === 'completed' ? { status: 'pending', label: 'Completed' }
      : { status: 'active', label: st === 'full' ? 'Active (full)' : 'Active' };

export default function ControlEvents() {
  const { req, mode } = useCC();
  const { id: deepLinkId } = useLocalSearchParams<{ id?: string }>();
  const [tab, setTab] = useState('');
  const [items, setItems] = useState<any[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [detailBusy, setDetailBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError('');
    try { setItems((await req(`/events${tab ? `?status=${tab}` : ''}`)).items); }
    catch (e: any) { setLoadError(e.message || 'Unable to load production data.'); }
  }, [req, tab]);

  useEffect(() => { setItems(null); load(); }, [load, mode]);

  const openDetail = useCallback(async (eventId: string) => {
    setDetailBusy(true);
    try { setDetail(await req(`/events/${eventId}`)); }
    catch (e: any) { setLoadError(e.message || 'Unable to load event.'); }
    finally { setDetailBusy(false); }
  }, [req]);

  // opened from an admin notification — jump straight to that event
  useEffect(() => { if (deepLinkId) openDetail(String(deepLinkId)); }, [deepLinkId, openDetail]);

  return (
    <Shell title="Events">
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TABS.map((t) => <Chip key={t.key || 'all'} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />)}
        </View>
      </Card>
      {loadError ? <Card><ErrorState message={loadError} onRetry={load} /></Card> : !items ? <Loading /> : !items.length ? <Card><EmptyText>No events here.</EmptyText></Card> : items.map((e: any) => (
        <Pressable key={e.id} onPress={() => openDetail(e.id)}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <View style={{ flex: 1, minWidth: 220 }}>
                <Text style={s.title}>{e.title}</Text>
                <Text style={s.sub}>
                  {e.category} · Host: {e.host?.name || 'Unknown'} · {fmtDT(String(e.start_datetime || ''))} · {e.going} confirmed
                </Text>
                {e.status === 'cancelled' && e.cancelled_at ? (
                  <Text style={[s.sub, { color: CC.red }]}>Cancelled {fmtDT(String(e.cancelled_at))}</Text>
                ) : null}
              </View>
              <Badge {...badgeFor(e.status)} />
            </View>
          </Card>
        </Pressable>
      ))}

      <ModalCard visible={!!detail || detailBusy} title={detail?.title || 'Event'} onClose={() => setDetail(null)}>
        {!detail ? <Loading /> : (
          <View>
            <View style={{ alignSelf: 'flex-start', marginBottom: 10 }}><Badge {...badgeFor(detail.status)} /></View>
            <SectionTitle>Details</SectionTitle>
            <Row k="Event" v={detail.title} />
            <Row k="Category" v={detail.category} />
            <Row k="Host" v={detail.host?.name || 'Unknown'} />
            <Row k="Date / time" v={`${fmtDT(String(detail.start_datetime || ''))}  →  ${fmtDT(String(detail.end_datetime || ''))}`} />
            {detail.location_display ? <Row k="Location" v={detail.location_display} /> : null}
            <Row k="Confirmed attendees" v={String(detail.confirmed_attendees)} />
            {detail.status === 'cancelled' ? (
              <>
                <SectionTitle>Cancellation</SectionTitle>
                <Row k="Cancelled at" v={detail.cancelled_at ? fmtDT(String(detail.cancelled_at)) : '—'} />
                <Row k="Cancelled by" v={detail.cancelled_by === detail.host?.id ? `Host (${detail.host?.name})` : detail.cancelled_by || 'Host'} />
                <Row k="Attendees affected" v={String(detail.confirmed_attendees)} />
                <Row k="In-app notifications" v={`${detail.notifications_sent} sent`} />
                <Row k="Cancellation emails" v={`${detail.emails?.sent || 0} sent · ${detail.emails?.failed || 0} failed${detail.emails?.skipped_or_queued ? ` · ${detail.emails.skipped_or_queued} skipped` : ''}`} />
              </>
            ) : null}
          </View>
        )}
      </ModalCard>
    </Shell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.row}>
      <Text style={s.k}>{k}</Text>
      <Text style={s.v}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 14, fontWeight: '800', color: CC.navy },
  sub: { fontSize: 12, color: CC.sub, marginTop: 2 },
  row: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: CC.border, gap: 10 },
  k: { fontSize: 12, color: CC.sub, width: 140, fontWeight: '700' },
  v: { fontSize: 12, color: CC.text, flex: 1 },
});
