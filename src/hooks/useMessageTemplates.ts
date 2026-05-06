import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  category: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useMessageTemplates() {
  return useQuery({
    queryKey: ['admin-message-templates'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('admin_message_templates')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as MessageTemplate[];
    },
  });
}

export function useSaveTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; content: string; category?: string }) => {
      const { error } = await (supabase as any).from('admin_message_templates').insert({
        name: input.name,
        content: input.content,
        category: input.category || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-message-templates'] }),
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('admin_message_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-message-templates'] }),
  });
}
