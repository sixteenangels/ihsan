import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders } from "../_shared/auth.ts";

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in get-paystack-key function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
