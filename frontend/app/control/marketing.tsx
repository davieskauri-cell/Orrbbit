import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Input, Btn, Badge, Loading, SectionTitle, Chip, EmptyText } from '../../src/control/ui';

export default function Marketing() {
  const { req, mode } = useCC();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [bTitle, setBTitle] = useState('');
  const [bMsg, setBMsg] = useState('');
  const [pCode, setPCode] = useState('');
  const [pPct, setPPct] = useState('20');
  const [pPlan, setPPlan] = useState('any');
  const [rName, setRName] = useState('');
  const [rReward, setRReward] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await req('/marketing')); } catch (e: any) { setError(e.message); setData({}); }
  }, [req]);
  useEffect(() => { setData(null); load(); }, [load, mode]);

  const post = async (path: string, body: any) => {
    setBusy(true); setError('');
    try { await req(path, { method: 'POST', body: JSON.stringify(body) }); load(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (!data) return <Shell title="Marketing"><Loading /></Shell>;
  return (
    <Shell title="Marketing">
      {error ? <Text style={{ color: CC.red, marginBottom: 8 }}>{error}</Text> : null}
      <Card style={{ backgroundColor: CC.tealSoft, borderColor: CC.teal }}>
        <Text style={{ color: CC.navy, fontSize: 13 }}>{data.note}</Text>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Card style={{ flexGrow: 1, flexBasis: 340, marginBottom: 0 }}>
          <SectionTitle>Announcement Banners</SectionTitle>
          <Input placeholder="Banner title" value={bTitle} onChangeText={setBTitle} />
          <Input placeholder="Banner message" value={bMsg} onChangeText={setBMsg} style={{ marginTop: 8 }} />
          <View style={{ marginTop: 10, alignItems: 'flex-start' }}>
            <Btn small title="Create banner" disabled={busy || !bTitle || !bMsg} onPress={() => { post('/marketing/banners', { title: bTitle, message: bMsg }); setBTitle(''); setBMsg(''); }} />
          </View>
          {(data.banners || []).map((b: any) => (
            <View key={b.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{b.title}</Text>
                <Text style={s.sub}>{b.message}</Text>
              </View>
              <Badge status={b.active ? 'active' : 'closed'} label={b.active ? 'live' : 'off'} />
              <Btn small variant="outline" title={b.active ? 'Disable' : 'Enable'} onPress={() => post(`/marketing/banners/${b.id}/toggle`, {})} />
            </View>
          ))}
          {!(data.banners || []).length ? <EmptyText>No banners yet.</EmptyText> : null}
        </Card>

        <Card style={{ flexGrow: 1, flexBasis: 340, marginBottom: 0 }}>
          <SectionTitle>Promo Codes</SectionTitle>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Input placeholder="CODE" autoCapitalize="characters" value={pCode} onChangeText={setPCode} style={{ flex: 1 }} />
            <Input placeholder="%" keyboardType="numeric" value={pPct} onChangeText={setPPct} style={{ width: 70 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {['any', 'intro_plus', 'intro_professional'].map((p) => <Chip key={p} label={p.replace('_', ' ')} active={pPlan === p} onPress={() => setPPlan(p)} />)}
          </View>
          <View style={{ marginTop: 10, alignItems: 'flex-start' }}>
            <Btn small title="Create promo code" disabled={busy || !pCode} onPress={() => { post('/marketing/promo-codes', { code: pCode, discount_pct: parseInt(pPct, 10) || 10, plan: pPlan }); setPCode(''); }} />
          </View>
          {(data.promo_codes || []).map((p: any) => (
            <View key={p.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{p.code} — {p.discount_pct}% off {p.plan.replace('_', ' ')}</Text>
                <Text style={s.sub}>{p.uses}/{p.max_uses} uses</Text>
              </View>
              <Badge status={p.active ? 'active' : 'closed'} label={p.active ? 'active' : 'off'} />
              <Btn small variant="outline" title={p.active ? 'Disable' : 'Enable'} onPress={() => post(`/marketing/promo-codes/${p.id}/toggle`, {})} />
            </View>
          ))}
          {!(data.promo_codes || []).length ? <EmptyText>No promo codes yet.</EmptyText> : null}
        </Card>

        <Card style={{ flexGrow: 1, flexBasis: 340, marginBottom: 0 }}>
          <SectionTitle>Referral Campaigns</SectionTitle>
          <Input placeholder="Campaign name" value={rName} onChangeText={setRName} />
          <Input placeholder="Reward (e.g. 1 month Intro Plus)" value={rReward} onChangeText={setRReward} style={{ marginTop: 8 }} />
          <View style={{ marginTop: 10, alignItems: 'flex-start' }}>
            <Btn small title="Create campaign" disabled={busy || !rName || !rReward} onPress={() => { post('/marketing/referrals', { name: rName, reward: rReward }); setRName(''); setRReward(''); }} />
          </View>
          {(data.referral_campaigns || []).map((r: any) => (
            <View key={r.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{r.name}</Text>
                <Text style={s.sub}>Reward: {r.reward} · {r.signups || 0} sign-ups</Text>
              </View>
              <Badge status={r.active ? 'active' : 'closed'} label={r.active ? 'active' : 'off'} />
              <Btn small variant="outline" title={r.active ? 'Disable' : 'Enable'} onPress={() => post(`/marketing/referrals/${r.id}/toggle`, {})} />
            </View>
          ))}
          {!(data.referral_campaigns || []).length ? <EmptyText>No campaigns yet.</EmptyText> : null}
        </Card>
      </View>

      <Card style={{ marginTop: 16 }}>
        <SectionTitle>Featured Content</SectionTitle>
        <Text style={s.sub}>Feature help requests from the Help Requests page (⭐). Featured professionals:</Text>
        {(data.featured_professionals || []).map((p: any) => (
          <View key={p.user_id} style={s.row}>
            <Text style={[s.name, { flex: 1 }]}>⭐ {p.name} — {p.profession} ({p.primary_category})</Text>
            <Btn small variant="outline" title="Unfeature" onPress={() => post(`/marketing/feature-professional/${p.user_id}`, {})} />
          </View>
        ))}
        {(data.featured_help_requests || []).map((r: any) => (
          <View key={r.id} style={s.row}><Text style={[s.name, { flex: 1 }]}>⭐ {r.public_summary} ({r.category})</Text></View>
        ))}
        {!(data.featured_professionals || []).length && !(data.featured_help_requests || []).length
          ? <EmptyText>Nothing featured yet. Feature professionals from a user detail page, or help requests via the ⭐ button.</EmptyText> : null}
      </Card>
    </Shell>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  name: { fontSize: 13, fontWeight: '700', color: CC.navy },
  sub: { fontSize: 12, color: CC.sub, marginTop: 2 },
});
