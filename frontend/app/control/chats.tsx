import { resolvePhotoUri } from "@/src/lib/photo";
import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Badge, Btn, Loading, EmptyText, ErrorState, ModalCard, SectionTitle } from '../../src/control/ui';
import { fmtDT } from '../../src/control/datetime';

export default function Chats() {
  const { req, mode } = useCC();
  const [data, setData] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [messages, setMessages] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msgError, setMsgError] = useState<string | null>(null);

  const load = () => {
    setData(null);
    setError(null);
    req('/chats').then(setData).catch((e: any) => setError(e.message || 'Unable to load production data.'));
  };

  useEffect(() => { load(); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const openConvo = async (convo: any) => {
    setViewing(convo);
    setMessages(null);
    setMsgError(null);
    try { setMessages((await req(`/chats/${convo.match_id}/messages`)).items); }
    catch (e: any) { setMsgError(e.message || 'Unable to load messages.'); }
  };

  return (
    <Shell title="Chats — Moderation" actions={<Badge status="pending" label="Read-only" />}>
      <Card style={{ backgroundColor: CC.tealSoft, borderColor: CC.teal }}>
        <Text style={{ color: CC.navy, fontSize: 13 }}>
          Moderation only. Conversations may be viewed when investigating reports — every view is audited.
          Messages can never be edited or deleted from here.
        </Text>
      </Card>
      {error ? <Card><ErrorState message={error} onRetry={load} /></Card> : !data ? <Loading /> : (
        <Card>
          <SectionTitle>Conversations ({data.items.length})</SectionTitle>
          {!data.messaging_launched ? (
            <Text style={{ fontSize: 12, color: CC.sub, marginBottom: 10 }}>
              In-app messaging has not launched yet — these are active connections with no message history.
            </Text>
          ) : null}
          {!data.items.length ? <EmptyText>No conversations.</EmptyText> : data.items.map((c: any) => (
            <View key={c.match_id} style={s.row}>
              <View style={{ flexDirection: 'row' }}>
                {c.participants.map((p: any, i: number) => (
                  p.photo_url
                    ? <Image key={p.id} source={{ uri: resolvePhotoUri(p.photo_url) }} style={[s.avatar, i > 0 && { marginLeft: -10 }]} />
                    : <View key={p.id} style={[s.avatar, { backgroundColor: CC.tealSoft }, i > 0 && { marginLeft: -10 }]} />
                ))}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{c.participants.map((p: any) => p.name || 'Unknown').join(' ↔ ')}</Text>
                <Text style={s.sub}>Connected {fmtDT(String(c.created_at), true)} · {c.message_count} messages</Text>
              </View>
              <Badge status={c.active ? 'active' : 'closed'} label={c.active ? 'active' : 'ended'} />
              <Btn small variant="outline" title="View" onPress={() => openConvo(c)} />
            </View>
          ))}
        </Card>
      )}
      <ModalCard visible={!!viewing} title={`Conversation — ${viewing?.participants?.map((p: any) => p.name).join(' ↔ ') || ''}`} onClose={() => setViewing(null)}>
        {msgError ? <ErrorState message={msgError} onRetry={() => viewing && openConvo(viewing)} /> : !messages ? <Loading /> : !messages.length ? (
          <EmptyText>No messages in this conversation yet. (This view was logged in the audit trail.)</EmptyText>
        ) : messages.map((m: any, i: number) => (
          <View key={i} style={s.msg}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: CC.navy }}>{m.sender_name || m.sender_id}</Text>
            <Text style={{ fontSize: 13, color: CC.text }}>{m.text || m.body}</Text>
            <Text style={{ fontSize: 10, color: CC.sub }}>{fmtDT(String(m.created_at || ''))}</Text>
          </View>
        ))}
      </ModalCard>
    </Shell>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  avatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#fff' },
  name: { fontSize: 13, fontWeight: '700', color: CC.text },
  sub: { fontSize: 11, color: CC.sub, marginTop: 2 },
  msg: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
});
