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
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: getCorsHeaders(req) });
  }

  try {
    const { customerId, priceId, successUrl, cancelUrl } = await req.json();

    if (!customerId || !priceId) {
      return new Response(JSON.stringify({ error: "Missing customerId or priceId" }), {
        status: 400,
        headers: getCorsHeaders(req),
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || "https://elementle-game.replit.app/account?status=success",
      cancel_url: cancelUrl || "https://elementle-game.replit.app/account?status=cancel",
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: getCorsHeaders(req),
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to create checkout session", details: String(err) }), {
      status: 500,
      headers: getCorsHeaders(req),
    });
  }
});
