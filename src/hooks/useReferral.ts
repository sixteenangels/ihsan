import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BRAND_REFERRAL_PREFIX } from '@/lib/brand';

export function useReferral() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data: referralCode, isLoading } = useQuery({
    queryKey: ['referral-code', userId],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: referrals = [], isLoading: isLoadingReferrals } = useQuery({
    queryKey: ['referral-tracking', userId],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('referral_tracking')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!userId) return undefined;

    const refreshReferralData = () => {
      void queryClient.invalidateQueries({ queryKey: ['referral-code', userId] });
      void queryClient.invalidateQueries({ queryKey: ['referral-tracking', userId] });
    };

    const channel = supabase
      .channel(`referrals:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'referral_codes',
          filter: `user_id=eq.${userId}`,
        },
        refreshReferralData,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'referral_tracking',
          filter: `referrer_id=eq.${userId}`,
        },
        refreshReferralData,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  const generateCode = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const code = `${BRAND_REFERRAL_PREFIX}-${user.id.substring(0, 8).toUpperCase()}`;
      const { error } = await supabase.from('referral_codes').insert({
        user_id: user.id,
        code,
      });
      if (error) throw error;
      return code;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referral-code', userId] });
    },
  });

  const referralLink = referralCode
    ? `${window.location.origin}/auth?ref=${referralCode.code}`
    : null;

  return {
    referralCode,
    referrals,
    referralLink,
    isLoading: isLoading || isLoadingReferrals,
    generateCode: generateCode.mutate,
    isGenerating: generateCode.isPending,
  };
}
