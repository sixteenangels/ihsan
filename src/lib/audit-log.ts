import { supabase } from '@/integrations/supabase/client';

interface AuditLogInput {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}

export async function logAdminAction(input: AuditLogInput) {
  if (!input.actorUserId) return;

  const { error } = await supabase.from('audit_logs' as never).insert({
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId || null,
    summary: input.summary,
    metadata: input.metadata || {},
  } as never);

  if (error) {
    console.error('Audit log error:', error);
  }
}
