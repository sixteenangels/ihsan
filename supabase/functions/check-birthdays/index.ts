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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get today's month-day
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    // Find profiles with birthday today
    const { data: birthdayProfiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, name, email, birthday')
      .not('birthday', 'is', null);

    if (profileError) throw profileError;

    const todayBirthdays = birthdayProfiles?.filter((p) => {
      if (!p.birthday) return false;
      const bday = p.birthday; // format: YYYY-MM-DD
      return bday.endsWith(`-${month}-${day}`);
    }) || [];

    let couponsCreated = 0;

    for (const profile of todayBirthdays) {
      // Check if we already sent a birthday coupon this year
      const yearCode = `BDAY-${today.getFullYear()}-${profile.user_id.substring(0, 8).toUpperCase()}`;
      
      const { data: existing } = await supabase
        .from('coupons')
        .select('id')
        .eq('code', yearCode)
        .maybeSingle();

      if (existing) continue; // Already sent this year

      // Create a 10% birthday coupon valid for 7 days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error: couponError } = await supabase.from('coupons').insert({
        code: yearCode,
        type: 'percentage',
        value: 10,
        max_uses: 1,
        current_uses: 0,
        is_active: true,
        expires_at: expiresAt.toISOString(),
      });

      if (couponError) {
        console.error('Failed to create coupon for', profile.user_id, couponError);
        continue;
      }

      // Notify the user
      await supabase.from('notifications').insert({
        user_id: profile.user_id,
        title: '🎂 Happy Birthday!',
        message: `Happy Birthday${profile.name ? ', ' + profile.name : ''}! Use code ${yearCode} for 10% off your next order. Valid for 7 days.`,
        type: 'promotion',
        data: { coupon_code: yearCode },
      });

      couponsCreated++;
    }

    return new Response(
      JSON.stringify({ success: true, birthdaysFound: todayBirthdays.length, couponsCreated }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Birthday check error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
