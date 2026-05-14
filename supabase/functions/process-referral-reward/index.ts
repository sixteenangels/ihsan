import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const REFERRAL_POINTS = 50;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function normalizeReferralCode(referralCode: unknown) {
  return typeof referralCode === 'string' ? referralCode.trim().toUpperCase() : '';
}

function parseSettingNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function isSettingDisabled(value: unknown) {
  if (value === false) return true;
  if (typeof value === 'string') return value.toLowerCase() === 'false';
  return false;
}

function getCouponCodeFromRewardData(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const couponCode = (data as Record<string, unknown>).coupon_code;
  return typeof couponCode === 'string' && couponCode.trim() ? couponCode : null;
}

async function syncReferralTotal(
  supabase: ReturnType<typeof createClient>,
  referrerId: string,
  referralCodeId: string,
) {
  const { count, error: countError } = await supabase
    .from('referral_tracking')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', referrerId);

  if (countError) throw countError;

  const totalReferrals = count ?? 0;
  const { error: updateError } = await supabase
    .from('referral_codes')
    .update({ total_referrals: totalReferrals })
    .eq('id', referralCodeId);

  if (updateError) throw updateError;

  return totalReferrals;
}

async function findExistingReferralReward(
  supabase: ReturnType<typeof createClient>,
  referrerId: string,
  trackingId: string,
) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, data')
    .eq('user_id', referrerId)
    .eq('type', 'promotion')
    .contains('data', {
      reward_kind: 'referral_signup',
      referral_tracking_id: trackingId,
    })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function ensureReferralReward(
  supabase: ReturnType<typeof createClient>,
  options: {
    referrerId: string;
    referredUserId: string;
    trackingId: string;
    discountPercent: number;
    maxUses: number;
    expiryDays: number;
  },
) {
  const existingReward = await findExistingReferralReward(
    supabase,
    options.referrerId,
    options.trackingId,
  );

  const existingCouponCode = getCouponCodeFromRewardData(existingReward?.data);

  if (existingCouponCode) {
    return { rewarded: false, couponCode: existingCouponCode };
  }

  const couponCode = `REF-${options.trackingId.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + options.expiryDays);

  const { error: couponError } = await supabase.from('coupons').upsert(
    {
      code: couponCode,
      type: 'percentage',
      value: options.discountPercent,
      max_uses: options.maxUses,
      current_uses: 0,
      is_active: true,
      expires_at: expiresAt.toISOString(),
    },
    {
      onConflict: 'code',
      ignoreDuplicates: true,
    },
  );

  if (couponError) throw couponError;

  const rewardDescription = `Referral reward - ${REFERRAL_POINTS} points (${options.trackingId
    .slice(0, 8)
    .toUpperCase()})`;

  const { data: existingPoints, error: pointsLookupError } = await supabase
    .from('loyalty_points')
    .select('id')
    .eq('user_id', options.referrerId)
    .eq('type', 'earn')
    .eq('description', rewardDescription)
    .limit(1)
    .maybeSingle();

  if (pointsLookupError) throw pointsLookupError;

  if (!existingPoints) {
    const { error: loyaltyError } = await supabase.from('loyalty_points').insert({
      user_id: options.referrerId,
      points: REFERRAL_POINTS,
      type: 'earn',
      description: rewardDescription,
    });

    if (loyaltyError) throw loyaltyError;
  }

  const rewardData = {
    coupon_code: couponCode,
    referral_tracking_id: options.trackingId,
    referred_user_id: options.referredUserId,
    reward_kind: 'referral_signup',
  };

  const { error: notificationError } = await supabase.from('notifications').insert({
    user_id: options.referrerId,
    title: 'Referral Reward',
    message: `Someone signed up with your referral code! Use ${couponCode} for ${options.discountPercent}% off your next order. Valid for ${options.expiryDays} days.`,
    type: 'promotion',
    data: rewardData,
  });

  if (notificationError && notificationError.code !== '23505') {
    throw notificationError;
  }

  return { rewarded: true, couponCode };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { referral_code, referred_user_id } = await req.json();
    const normalizedReferralCode = normalizeReferralCode(referral_code);

    if (!normalizedReferralCode || !referred_user_id) {
      return jsonResponse({ error: 'Missing referral_code or referred_user_id' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: codeData, error: codeError } = await supabase
      .from('referral_codes')
      .select('*')
      .ilike('code', normalizedReferralCode)
      .maybeSingle();

    if (codeError) throw codeError;

    if (!codeData) {
      return jsonResponse({ error: 'Invalid referral code' }, 400);
    }

    if (codeData.user_id === referred_user_id) {
      return jsonResponse({ error: 'Cannot refer yourself' }, 400);
    }

    const { data: existingTracking, error: existingTrackingError } = await supabase
      .from('referral_tracking')
      .select('id, referrer_id, referred_user_id, created_at')
      .eq('referred_user_id', referred_user_id)
      .maybeSingle();

    if (existingTrackingError) throw existingTrackingError;

    let tracking = existingTracking;
    let createdTracking = false;

    if (!tracking) {
      const { data: insertedTracking, error: trackingError } = await supabase
        .from('referral_tracking')
        .insert({
          referrer_id: codeData.user_id,
          referred_user_id,
        })
        .select('id, referrer_id, referred_user_id, created_at')
        .single();

      if (trackingError) {
        if (trackingError.code !== '23505') throw trackingError;

        const { data: duplicateTracking, error: duplicateLookupError } = await supabase
          .from('referral_tracking')
          .select('id, referrer_id, referred_user_id, created_at')
          .eq('referred_user_id', referred_user_id)
          .maybeSingle();

        if (duplicateLookupError) throw duplicateLookupError;
        tracking = duplicateTracking;
      } else {
        tracking = insertedTracking;
        createdTracking = true;
      }
    }

    if (!tracking) {
      throw new Error('Unable to record referral tracking');
    }

    if (tracking.referrer_id !== codeData.user_id) {
      const totalReferrals = await syncReferralTotal(supabase, codeData.user_id, codeData.id);
      return jsonResponse({
        message: 'User already has a referral recorded',
        tracked: true,
        rewarded: false,
        total_referrals: totalReferrals,
      });
    }

    const totalReferrals = await syncReferralTotal(supabase, codeData.user_id, codeData.id);

    const { data: enabledSetting } = await supabase
      .from('store_settings')
      .select('value')
      .eq('key', 'referralEnabled')
      .maybeSingle();

    if (isSettingDisabled(enabledSetting?.value)) {
      return jsonResponse({
        success: true,
        tracked: true,
        created: createdTracking,
        rewarded: false,
        message: 'Referral programme disabled',
        total_referrals: totalReferrals,
      });
    }

    const { data: settingsRows, error: settingsError } = await supabase
      .from('store_settings')
      .select('key, value')
      .in('key', ['referral_discount_percent', 'referral_max_uses', 'referral_expiry_days']);

    if (settingsError) throw settingsError;

    const settings: Record<string, unknown> = {};
    settingsRows?.forEach((row) => {
      settings[row.key] = row.value;
    });

    const discountPercent = parseSettingNumber(settings.referral_discount_percent, 10);
    const maxUses = Math.max(1, Math.floor(parseSettingNumber(settings.referral_max_uses, 1)));
    const expiryDays = Math.max(1, Math.floor(parseSettingNumber(settings.referral_expiry_days, 14)));

    const reward = await ensureReferralReward(supabase, {
      referrerId: codeData.user_id,
      referredUserId: referred_user_id,
      trackingId: tracking.id,
      discountPercent,
      maxUses,
      expiryDays,
    });

    return jsonResponse({
      success: true,
      tracked: true,
      created: createdTracking,
      rewarded: reward.rewarded,
      coupon_code: reward.couponCode,
      total_referrals: totalReferrals,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Referral reward error:', error);
    return jsonResponse({ error: errorMessage }, 500);
  }
});
