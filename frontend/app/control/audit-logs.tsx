import React, { useEffect, useState, useCallback } from 'react';
import { View, Text } from 'react-native';
import Shell from '../../src/control/Shell';
import { useCC } from '../../src/control/ControlContext';
import { CC } from '../../src/control/theme';
import { Card, Input, Table, Tr, Td, Badge, Loading, EmptyText, Pager } from '../../src/control/ui';

export default function AuditLogs() {
  const { req, mode } = useCC();
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await req(`/audit-logs?page=${page}&limit=50${action ? `&action=${encodeURIComponent(action)}` : ''}`));
      setError('');
    } catch (e: any) { setError(e.message); setData({ items: [], total: 0 }); }
  }, [req, page, action]);

  useEffect(() => { const t = setTimeout(load, action ? 350 : 0); return () => clearTimeout(t); }, [load, mode]);
  useEffect(() => { setPage(1); }, [action]);

  return (
    <Shell title="Audit Logs">
      {error ? <Text style={{ color: CC.red, marginBottom: 8 }}>{error}</Text> : null}
      <Card>
        <Input placeholder="Filter by action (e.g. ban, verification, password)…" value={action} onChangeText={setAction} />
      </Card>
      {!data ? <Loading /> : (
        <Card>
          <Table columns={['When', 'Admin', 'Action', 'Target', 'Mode', 'Changes', 'IP']} widths={[1.1, 1.4, 1.2, 1.3, 0.5, 1.8, 0.8]}>
            {!data.items.length ? <EmptyText>No audit entries.</EmptyText> : data.items.map((a: any) => (
              <Tr key={a.id}>
                <Td flex={1.1}>{String(a.at).slice(0, 16).replace('T', ' ')}</Td>
                <Td flex={1.4}>{a.admin_email}</Td>
                <Td flex={1.2}><Badge status={a.action.includes('ban') || a.action.includes('delete') ? 'banned' : 'actioned'} label={a.action} /></Td>
                <Td flex={1.3}>{`${a.target_type}: ${String(a.target_id).slice(0, 14)}`}</Td>
                <Td flex={0.5}><Badge status={a.mode === 'live' ? 'banned' : 'new'} label={a.mode} /></Td>
                <Td flex={1.8}>
                  <Text style={{ fontSize: 11, color: CC.sub }} numberOfLines={2}>
                    {a.old_value ? `old: ${JSON.stringify(a.old_value)} ` : ''}{a.new_value ? `new: ${JSON.stringify(a.new_value)}` : '—'}
                  </Text>
                </Td>
                <Td flex={0.8}>{a.ip || '—'}</Td>
              </Tr>
            ))}
          </Table>
          <Pager page={page} total={data.total} limit={50} onPage={setPage} />
        </Card>
      )}
    </Shell>
  );
}
