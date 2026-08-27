import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Badge, Btn, Loading, SectionTitle, Chip, EmptyText, ModalCard } from '../../src/control/ui';
import { fmtDT } from '../../src/control/datetime';

export default function AiInsights() {
  const { req, download, mode } = useCC();
  const [data, setData] = useState<any>(null);
  const [type, setType] = useState('daily_summary');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<any>(null);

  const load = useCallback(async () => {
    try { setData(await req('/ai/insights')); } catch (e: any) { setError(e.message); setData({ configured: false, items: [], report_types: [] }); }
  }, [req]);
  useEffect(() => { setData(null); load(); }, [load, mode]);

  const generate = async () => {
    setGenerating(true); setError('');
    try {
      const res = await req('/ai/insights/generate', { method: 'POST', body: JSON.stringify({ report_type: type }) });
      setViewing(res.report);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setGenerating(false); }
  };

  if (!data) return <Shell title="AI Insights"><Loading /></Shell>;
  return (
    <Shell title="AI Insights" actions={<Badge status={data.configured ? 'active' : 'not_configured'} label={data.configured ? `AI ready · ${data.settings?.model}` : 'AI Not Configured'} />}>
      {error ? <Text style={{ color: CC.red, marginBottom: 8 }}>{error}</Text> : null}
      <Card style={{ backgroundColor: CC.amberSoft, borderColor: CC.amber }}>
        <Text style={{ color: CC.navy, fontSize: 12 }}>⚠ {data.disclaimer}</Text>
      </Card>
      {!data.configured ? (
        <Card><EmptyText>AI is not configured. The Control Centre keeps working normally — connect an AI provider in settings to enable insight reports.</EmptyText></Card>
      ) : (
        <Card>
          <SectionTitle>Generate a report ({mode.toUpperCase()} data)</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {data.report_types.map((r: any) => <Chip key={r.key} label={r.label} active={type === r.key} onPress={() => setType(r.key)} />)}
          </View>
          <View style={{ alignItems: 'flex-start' }}>
            <Btn title={generating ? 'Generating (10–30s)…' : 'Generate report'} disabled={generating} onPress={generate} />
          </View>
        </Card>
      )}
      <Card>
        <SectionTitle>Previous reports</SectionTitle>
        {!data.items.length ? <EmptyText>No reports yet.</EmptyText> : data.items.map((r: any) => (
          <View key={r.id} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{r.label}</Text>
              <Text style={s.sub}>{fmtDT(String(r.created_at))} · {r.generated_by} · {r.model}</Text>
            </View>
            <Btn small variant="outline" title="View" onPress={() => setViewing(r)} />
            <Btn small variant="ghost" title="PDF" onPress={() => download(`/ai/insights/${r.id}/export?format=pdf`, `ai-report-${r.id.slice(0, 8)}.pdf`).catch((e) => setError(e.message))} />
            <Btn small variant="ghost" title="CSV" onPress={() => download(`/ai/insights/${r.id}/export?format=csv`, `ai-report-${r.id.slice(0, 8)}.csv`).catch((e) => setError(e.message))} />
          </View>
        ))}
      </Card>
      <ModalCard visible={!!viewing} title={viewing?.label || ''} onClose={() => setViewing(null)}>
        <ScrollView style={{ maxHeight: 420 }}>
          <Text style={{ fontSize: 13, color: CC.text, lineHeight: 20 }}>{viewing?.content}</Text>
          <Text style={{ fontSize: 11, color: CC.sub, marginTop: 12, fontStyle: 'italic' }}>{viewing?.disclaimer}</Text>
        </ScrollView>
      </ModalCard>
    </Shell>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  name: { fontSize: 13, fontWeight: '700', color: CC.navy },
  sub: { fontSize: 11, color: CC.sub, marginTop: 2 },
});
