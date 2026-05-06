import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const publicKey = Deno.env.get("Live_Public_Key");

    if (!publicKey) {
      console.error("Paystack public key not configured. Add 'Live_Public_Key' secret in Cloud settings.");
      return new Response(
        JSON.stringify({ 
          error: "Payment configuration error",
          message: "Paystack public key not configured. Please add it in settings."
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate key format - should start with pk_
    if (!publicKey.startsWith("pk_")) {
      console.error("Invalid Paystack key format. Expected pk_test_* or pk_live_*");
      return new Response(
        JSON.stringify({ 
          error: "Invalid key format",
          message: "Paystack key should start with pk_test_ or pk_live_"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const mode = publicKey.startsWith("pk_test_") ? "test" : "live";
    console.log(`Paystack public key retrieved successfully (${mode} mode)`);

    return new Response(
      JSON.stringify({ publicKey }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in get-paystack-key function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
