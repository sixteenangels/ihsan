import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useReferral() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: referralCode, isLoading } = useQuery({
    queryKey: ['referral-code', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ['referral-tracking', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('referral_tracking')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const generateCode = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const code = `IHSAN-${user.id.substring(0, 8).toUpperCase()}`;
      const { error } = await supabase.from('referral_codes').insert({
        user_id: user.id,
        code,
      });
      if (error) throw error;
      return code;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referral-code', user?.id] });
    },
  });

  const referralLink = referralCode
    ? `${window.location.origin}/auth?ref=${referralCode.code}`
    : null;

  return {
    referralCode,
    referrals,
    referralLink,
    isLoading,
    generateCode: generateCode.mutate,
    isGenerating: generateCode.isPending,
  };
}
