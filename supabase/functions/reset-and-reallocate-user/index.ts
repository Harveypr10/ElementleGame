// supabase/functions/reset-and-reallocate-user/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
);

serve(async (req) => {
  const origin = req.headers.get("Origin") || "";

  // Allow production domain and any replit.dev preview domains
  const isAllowed =
    origin === "https://elementle-game.replit.app" ||
    origin.endsWith(".replit.dev");

  const corsHeaders = {
    "Access-Control-Allow-Origin": isAllowed
      ? origin
      : "https://elementle-game.replit.app",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  };

  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const userId = body.user_id;

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Clear existing allocations
    const { error: delAllocErr } = await supabase.rpc(
      "delete_unattempted_allocations",
      { p_user_id: userId }
    );
    if (delAllocErr) {
      console.error("[ResetAllocations] RPC failed:", delAllocErr);
      return new Response(JSON.stringify({ error: String(delAllocErr) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Force fresh read of category preferences to avoid stale cache
    const { data: categories, error: catErr } = await supabase
      .from("user_category_preferences")
      .select("*")
      .eq("user_id", userId);

    if (catErr) {
      console.error("[ResetAllocations] Category fetch failed:", catErr);
    } else {
      console.log(
        "[ResetAllocations] Fresh category preferences loaded:",
        categories
      );
    }

    return new Response(
      JSON.stringify({
        status: "reset complete — unplayed allocations cleared",
        categories: categories ?? null
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (err) {
    console.error("[ResetAllocations] Unexpected error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
