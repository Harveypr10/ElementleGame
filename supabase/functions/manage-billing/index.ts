import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.0.0";

// Dynamic CORS headers: allow production + any .replit.dev preview domains
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const isAllowed =
    origin === "https://elementle-game.replit.app" ||
    origin.endsWith(".replit.dev");

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://elementle-game.replit.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: getCorsHeaders(req) });
  }

  try {
    const { customerId, returnUrl } = await req.json();

    if (!customerId) {
      return new Response(JSON.stringify({ error: "Missing customerId" }), {
        status: 400,
        headers: getCorsHeaders(req),
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || "https://elementle-game.replit.app/account",
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: getCorsHeaders(req),
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Failed to create billing portal session", details: String(err) }),
      { status: 500, headers: getCorsHeaders(req) }
    );
  }
});
