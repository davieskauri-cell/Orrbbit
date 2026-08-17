import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Switch, Platform } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, SectionTitle, KpiCard, Badge, Btn, Input, Table, Tr, Td, EmptyText, Loading, Pager, ModalCard, Chip } from '../../src/control/ui';

const TABS = ['Templates', 'Events', 'Failures & Bounces'];

export default function EmailsAdmin() {
  const { req } = useCC();
  const [tab, setTab] = useState('Templates');
  const [error, setError] = useState('');

  // templates
  const [templates, setTemplates] = useState<any[] | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [previewFor, setPreviewFor] = useState('');
  const [testTo, setTestTo] = useState('');
  const [testResult, setTestResult] = useState('');

  // events
  const [events, setEvents] = useState<any>(null);
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState('');
  const [page, setPage] = useState(1);

  // stats / failures
  const [stats, setStats] = useState<any>(null);
  const [suppressions, setSuppressions] = useState<any[] | null>(null);

  const loadTemplates = useCallback(async () => {
    try { setTemplates((await req('/email/templates')).items); setError(''); }
    catch (e: any) { setError(e.message); setTemplates([]); }
  }, [req]);

  const loadEvents = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (q) params.set(q.includes('@') || q.includes('.') ? 'email' : 'user_id', q);
      if (statusF) params.set('status', statusF);
      setEvents(await req(`/email/events?${params.toString()}`));
      setError('');
    } catch (e: any) { setError(e.message); setEvents({ items: [], total: 0 }); }
  }, [req, q, statusF, page]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await req('/email/stats'));
      setSuppressions((await req('/email/suppressions')).items);
      setError('');
    } catch (e: any) { setError(e.message); }
  }, [req]);

  useEffect(() => {
    if (tab === 'Templates') loadTemplates();
    if (tab === 'Events') { const t = setTimeout(loadEvents, q ? 350 : 0); return () => clearTimeout(t); }
    if (tab === 'Failures & Bounces') loadStats();
  }, [tab, loadTemplates, loadEvents, loadStats]);
  useEffect(() => { setPage(1); }, [q, statusF]);

  const openPreview = async (key: string) => {
    setPreviewFor(key); setPreview(null); setTestResult('');
    try { setPreview(await req(`/email/templates/${key}/preview`)); }
    catch (e: any) { setPreview({ error: e.message }); }
  };

  const sendTest = async () => {
    setTestResult('Sending…');
    try {
      const r = await req(`/email/templates/${previewFor}/test`, { method: 'POST', body: JSON.stringify({ to_email: testTo }) });
      setTestResult(r.status === 'sent' ? `✅ Sent (Resend id: ${r.resend_id})` : `⚠️ ${r.status}: ${r.reason || ''}`);
    } catch (e: any) { setTestResult(`❌ ${e.message}`); }
  };

  const toggleTemplate = async (key: string, enabled: boolean) => {
    try {
      await req(`/email/templates/${key}/settings`, { method: 'PUT', body: JSON.stringify({ enabled }) });
      setTemplates((ts) => (ts || []).map((t) => (t.key === key ? { ...t, enabled } : t)));
    } catch (e: any) { setError(e.message); }
  };

  const retry = async (id: string) => {
    try { await req(`/email/events/${id}/retry`, { method: 'POST' }); loadEvents(); loadStats(); }
    catch (e: any) { setError(e.message); }
  };

  const unsuppress = async (email: string) => {
    try { await req(`/email/suppressions/${encodeURIComponent(email)}`, { method: 'DELETE' }); loadStats(); }
    catch (e: any) { setError(e.message); }
  };

  return (
    <Shell title="Emails">
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {TABS.map((t) => <Chip key={t} label={t} active={tab === t} onPress={() => setTab(t)} />)}
      </View>
      {error ? <Text style={{ color: CC.red, marginBottom: 8 }}>{error}</Text> : null}

      {tab === 'Templates' && (!templates ? <Loading /> : (
        <Card>
          <SectionTitle>All templates ({templates.length}) — mandatory templates cannot be disabled</SectionTitle>
          <Table columns={['Template', 'Subject', 'Category', 'Trigger', 'Enabled', '']} widths={[1.3, 1.6, 1, 1.6, 0.6, 0.8]}>
            {templates.map((t) => (
              <Tr key={t.key}>
                <Td flex={1.3}><Text style={{ fontWeight: '700', color: CC.navy, fontSize: 12 }}>{t.key}</Text></Td>
                <Td flex={1.6}><Text style={{ fontSize: 11, color: CC.sub }} numberOfLines={1}>{t.subject}</Text></Td>
                <Td flex={1}>{t.mandatory ? <Badge status="banned" label="mandatory" /> : <Badge status="new" label={t.category} />}</Td>
                <Td flex={1.6}><Text style={{ fontSize: 10, color: CC.sub }} numberOfLines={2}>{t.trigger}</Text></Td>
                <Td flex={0.6}>
                  <Switch value={t.enabled} disabled={t.mandatory} onValueChange={(v) => toggleTemplate(t.key, v)} />
                </Td>
                <Td flex={0.8}><Btn small title="Preview" onPress={() => openPreview(t.key)} /></Td>
              </Tr>
            ))}
          </Table>
        </Card>
      ))}

      {tab === 'Events' && (
        <>
          <Card>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <View style={{ flex: 1, minWidth: 200 }}>
                <Input placeholder="Search by email or user ID…" value={q} onChangeText={setQ} />
              </View>
              {['', 'sent', 'failed', 'queued'].map((s) => (
                <Chip key={s || 'all'} label={s || 'all'} active={statusF === s} onPress={() => setStatusF(s)} />
              ))}
            </View>
          </Card>
          {!events ? <Loading /> : (
            <Card>
              <Table columns={['When', 'Template', 'To', 'Subject', 'Status', 'Resend ID', '']} widths={[1, 1.2, 1.4, 1.5, 0.7, 1, 0.7]}>
                {!events.items.length ? <EmptyText>No email events.</EmptyText> : events.items.map((e: any) => (
                  <Tr key={e.id}>
                    <Td flex={1}>{String(e.created_at).slice(0, 16).replace('T', ' ')}</Td>
                    <Td flex={1.2}><Text style={{ fontSize: 11, fontWeight: '600', color: CC.navy }}>{e.template}{e.is_test ? ' (test)' : ''}</Text></Td>
                    <Td flex={1.4}><Text style={{ fontSize: 11 }} numberOfLines={1}>{e.to_email}</Text></Td>
                    <Td flex={1.5}><Text style={{ fontSize: 11, color: CC.sub }} numberOfLines={1}>{e.subject}</Text></Td>
                    <Td flex={0.7}><Badge status={e.status === 'sent' ? 'active' : e.status === 'failed' ? 'banned' : 'new'} label={e.status} /></Td>
                    <Td flex={1}><Text style={{ fontSize: 10, color: CC.sub }} numberOfLines={1}>{e.resend_id || e.failure_reason || '—'}</Text></Td>
                    <Td flex={0.7}>{e.status === 'failed' ? <Btn small title="Retry" onPress={() => retry(e.id)} /> : null}</Td>
                  </Tr>
                ))}
              </Table>
              <Pager page={page} total={events.total} limit={50} onPage={setPage} />
            </Card>
          )}
        </>
      )}

      {tab === 'Failures & Bounces' && (!stats ? <Loading /> : (
        <>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <KpiCard label="Sent" value={stats.counts.sent} accent={CC.teal} />
            <KpiCard label="Failed" value={stats.counts.failed} accent={CC.red} />
            <KpiCard label="Suppressed" value={stats.suppressions} />
            <KpiCard label="Bounced addresses" value={stats.bounces} />
          </View>
          {stats.verification_funnel ? (
            <Card>
              <SectionTitle>Email verification funnel (real users)</SectionTitle>
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                <KpiCard label="Total users" value={stats.verification_funnel.total_users} />
                <KpiCard label="Verified" value={stats.verification_funnel.verified} accent={CC.teal} />
                <KpiCard label="Unverified" value={stats.verification_funnel.unverified} accent={CC.red} />
                <KpiCard label="Verification rate" value={`${stats.verification_funnel.verification_rate}%`} accent={CC.teal} />
                <KpiCard label="Verify emails sent" value={stats.verification_funnel.verify_emails_sent} />
                <KpiCard label="Verified last 7 days" value={stats.verification_funnel.verified_last_7d} />
              </View>
            </Card>
          ) : null}
          <Card>
            <SectionTitle>Scheduler last run: {stats.scheduler_last_run ? String(stats.scheduler_last_run).slice(0, 19).replace('T', ' ') : 'not yet'}</SectionTitle>
            <SectionTitle>Recent failures</SectionTitle>
            <Table columns={['When', 'Template', 'To', 'Reason', '']} widths={[1, 1.2, 1.4, 2, 0.7]}>
              {!stats.recent_failures.length ? <EmptyText>No failures 🎉</EmptyText> : stats.recent_failures.map((e: any) => (
                <Tr key={e.id}>
                  <Td flex={1}>{String(e.created_at).slice(0, 16).replace('T', ' ')}</Td>
                  <Td flex={1.2}>{e.template}</Td>
                  <Td flex={1.4}><Text style={{ fontSize: 11 }} numberOfLines={1}>{e.to_email}</Text></Td>
                  <Td flex={2}><Text style={{ fontSize: 10, color: CC.red }} numberOfLines={2}>{e.failure_reason}</Text></Td>
                  <Td flex={0.7}><Btn small title="Retry" onPress={() => retry(e.id)} /></Td>
                </Tr>
              ))}
            </Table>
          </Card>
          <Card>
            <SectionTitle>Suppressed recipients (bounces / complaints)</SectionTitle>
            <Table columns={['Email', 'Reason', 'Since', '']} widths={[1.6, 1, 1, 0.8]}>
              {!suppressions?.length ? <EmptyText>No suppressed recipients.</EmptyText> : suppressions.map((s: any) => (
                <Tr key={s.email}>
                  <Td flex={1.6}>{s.email}</Td>
                  <Td flex={1}><Badge status="banned" label={s.reason} /></Td>
                  <Td flex={1}>{String(s.created_at).slice(0, 10)}</Td>
                  <Td flex={0.8}><Btn small title="Remove" onPress={() => unsuppress(s.email)} /></Td>
                </Tr>
              ))}
            </Table>
          </Card>
        </>
      ))}

      <ModalCard visible={!!previewFor} title={`Preview — ${previewFor}`} onClose={() => setPreviewFor('')}>
        {!preview ? <Loading /> : preview.error ? <Text style={{ color: CC.red }}>{preview.error}</Text> : (
          <ScrollView style={{ maxHeight: 480 }}>
            <Text style={{ fontWeight: '700', color: CC.navy, marginBottom: 6 }}>Subject: {preview.subject}</Text>
            {Platform.OS === 'web' ? (
              // @ts-ignore — web-only rich preview
              <iframe srcDoc={preview.html} style={{ width: '100%', height: 420, border: '1px solid #E5E7EB', borderRadius: 8 }} />
            ) : (
              <Text style={{ fontSize: 12, color: CC.sub, lineHeight: 18 }}>{preview.text}</Text>
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Input placeholder="test@yourdomain.com" value={testTo} onChangeText={setTestTo} />
              </View>
              <Btn title="Send test" onPress={sendTest} />
            </View>
            {testResult ? <Text style={{ marginTop: 8, fontSize: 12, color: CC.navy }}>{testResult}</Text> : null}
          </ScrollView>
        )}
      </ModalCard>
    </Shell>
  );
}
