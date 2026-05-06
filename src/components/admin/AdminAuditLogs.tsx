import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollText, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function AdminAuditLogs() {
  const [search, setSearch] = useState('');

  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['admin-audit-log-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, name, email');
      if (error) throw error;
      return data || [];
    },
  });

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.user_id, profile])),
    [profiles],
  );

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return auditLogs;
    const normalized = search.trim().toLowerCase();

    return auditLogs.filter((log: any) => {
      const actor = profileMap.get(log.actor_user_id);
      return [
        log.action,
        log.entity_type,
        log.entity_id,
        log.summary,
        actor?.name,
        actor?.email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [auditLogs, profileMap, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-serif text-foreground flex items-center gap-2">
          <ScrollText className="h-7 w-7 text-primary" />
          Audit Logs
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Admin Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Filter by action, actor, entity, or summary..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log: any) => {
                  const actor = profileMap.get(log.actor_user_id);

                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {actor?.name || actor?.email || log.actor_user_id}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.entity_type}
                        {log.entity_id ? `:${log.entity_id}` : ''}
                      </TableCell>
                      <TableCell className="max-w-md text-sm">{log.summary}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No audit activity found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
