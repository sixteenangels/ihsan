import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { referral_code, referred_user_id } = await req.json();
    if (!referral_code || !referred_user_id) {
      return new Response(JSON.stringify({ error: 'Missing referral_code or referred_user_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Look up the referral code
    const { data: codeData, error: codeError } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('code', referral_code)
      .maybeSingle();

    if (codeError || !codeData) {
      return new Response(JSON.stringify({ error: 'Invalid referral code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Don't let users refer themselves
    if (codeData.user_id === referred_user_id) {
      return new Response(JSON.stringify({ error: 'Cannot refer yourself' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if already tracked
    const { data: existingTracking } = await supabase
      .from('referral_tracking')
      .select('id')
      .eq('referrer_id', codeData.user_id)
      .eq('referred_user_id', referred_user_id)
      .maybeSingle();

    if (existingTracking) {
      return new Response(JSON.stringify({ message: 'Already tracked' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Track the referral
    await supabase.from('referral_tracking').insert({
      referrer_id: codeData.user_id,
      referred_user_id,
    });

    // Increment total_referrals
    await supabase
      .from('referral_codes')
      .update({ total_referrals: (codeData.total_referrals || 0) + 1 })
      .eq('id', codeData.id);

    // Check if referral programme is enabled
    const { data: enabledSetting } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'referralEnabled')
      .maybeSingle();

    if (enabledSetting?.value === false) {
      return new Response(JSON.stringify({ message: 'Referral programme disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Read reward settings from store_settings
    const { data: settingsRows } = await supabase
      .from('store_settings')
      .select('key, value')
      .in('key', ['referral_discount_percent', 'referral_max_uses', 'referral_expiry_days']);

    const settings: Record<string, any> = {};
    settingsRows?.forEach((r: any) => { settings[r.key] = r.value; });

    const discountPercent = typeof settings.referral_discount_percent === 'number' ? settings.referral_discount_percent : 10;
    const maxUses = typeof settings.referral_max_uses === 'number' ? settings.referral_max_uses : 1;
    const expiryDays = typeof settings.referral_expiry_days === 'number' ? settings.referral_expiry_days : 14;

    // Create a referral reward coupon for the referrer
    const couponCode = `REF-${Date.now().toString(36).toUpperCase()}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    await supabase.from('coupons').insert({
      code: couponCode,
      type: 'percentage',
      value: discountPercent,
      max_uses: maxUses,
      current_uses: 0,
      is_active: true,
      expires_at: expiresAt.toISOString(),
    });

    // Notify referrer
    await supabase.from('notifications').insert({
      user_id: codeData.user_id,
      title: '🎉 Referral Reward!',
      message: `Someone signed up with your referral code! Use ${couponCode} for ${discountPercent}% off your next order. Valid for ${expiryDays} days.`,
      type: 'promotion',
      data: { coupon_code: couponCode },
    });

    // Award loyalty points to referrer
    await supabase.from('loyalty_points').insert({
      user_id: codeData.user_id,
      points: 50,
      type: 'earn',
      description: 'Referral reward — 50 points',
    });

    return new Response(
      JSON.stringify({ success: true, coupon_code: couponCode }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Referral reward error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
