import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const secretKey = Deno.env.get("Live_Secret_Key");
    if (!secretKey) {
      return new Response(
        JSON.stringify({ verified: false, error: "Payment verification not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { reference } = await req.json();
    if (!reference || typeof reference !== "string") {
      return new Response(
        JSON.stringify({ verified: false, error: "Missing payment reference" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Call Paystack verify endpoint
    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      }
    );

    const paystackData = await paystackRes.json();

    if (!paystackRes.ok || !paystackData.status) {
      console.error("Paystack verify failed:", paystackData);
      return new Response(
        JSON.stringify({
          verified: false,
          error: paystackData.message || "Verification failed",
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const txn = paystackData.data;
    const verified = txn.status === "success";

    console.log(`Payment ${reference}: status=${txn.status}, amount=${txn.amount}, currency=${txn.currency}`);

    return new Response(
      JSON.stringify({
        verified,
        status: txn.status,
        amount: txn.amount, // in pesewas
        currency: txn.currency,
        channel: txn.channel,
        paid_at: txn.paid_at,
        reference: txn.reference,
        metadata: txn.metadata,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error verifying payment:", error);
    return new Response(
      JSON.stringify({ verified: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
