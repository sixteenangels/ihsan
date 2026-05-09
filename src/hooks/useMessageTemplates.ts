import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';

export type MessageTemplate = Tables<'admin_message_templates'>;

export function useMessageTemplates() {
  return useQuery({
    queryKey: ['admin-message-templates'],
    queryFn: async (): Promise<MessageTemplate[]> => {
      const { data, error } = await supabase
        .from('admin_message_templates')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSaveTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; content: string; category?: string }) => {
      if (!user?.id) {
        throw new Error('You must be signed in to save a template.');
      }

      const payload: TablesInsert<'admin_message_templates'> = {
        name: input.name,
        content: input.content,
        category: input.category || null,
        created_by: user.id,
      };

      const { error } = await supabase.from('admin_message_templates').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-message-templates'] }),
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('admin_message_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-message-templates'] }),
  });
}
