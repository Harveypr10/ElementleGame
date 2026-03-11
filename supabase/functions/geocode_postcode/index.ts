// supabase/functions/geocode_postcode/index.ts

type PostcodesIoResponse = {
  status: number;
  result?: {
    latitude: number;
    longitude: number;
    country: string;
    admin_district?: string;
    admin_county?: string;
    parish?: string;
  };
  error?: string;
};

function roundToHalfMiles(miles: number) {
  return Math.ceil(miles * 2) / 2;
}

function sizePoints(size: string) {
  switch (size) {
    case 'very_small': return 1;
    case 'small': return 3;
    case 'medium': return 5;
    case 'large': return 10;
    default: return 1;
  }
}

const MAX_RADIUS_MILES = 20;
const METERS_PER_MILE = 1609.34;
const RADIUS_METERS = MAX_RADIUS_MILES * METERS_PER_MILE;

console.log("Handler file loaded");

export default async function handle(req: Request): Promise<Response> {
  console.log("Function started");
  try {
    if (req.method !== 'POST') {
      console.log("Invalid method:", req.method);
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    // ✅ Extract JWT from Authorization header
    const authHeader = req.headers.get('authorization');
    console.log("Auth header present?", !!authHeader);
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '').trim();
    console.log("Token length:", token.length);

    // Connect to Supabase with service role key
    const url = Deno.env.get('PROJECT_URL');
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY');
    console.log("Env URL present?", !!url, "Service key present?", !!serviceKey);
    if (!url || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase env config' }), { status: 500 });
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    // ✅ Get the user from the JWT
    console.log("About to call getUser");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    console.log("After getUser", { userId: user?.id, userErr });
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401 });
    }
    const userId = user.id;

    // Parse body (only postcode now)
    const { postcode } = await req.json().catch(() => ({}));
    console.log("Parsed body postcode:", postcode);
    if (!postcode) {
      return new Response(JSON.stringify({ error: 'Missing postcode' }), { status: 400 });
    }

    // Clean the postcode
    const cleaned = String(postcode).trim().toUpperCase().replace(/\s+/g, '');
    console.log("Cleaned postcode:", cleaned);
    if (!/^[A-Z0-9]{2,8}$/.test(cleaned)) {
      return new Response(JSON.stringify({ error: 'Invalid postcode format' }), { status: 400 });
    }

    // Call postcodes.io
    console.log("Calling postcodes.io");
    const resp = await fetch(`https://api.postcodes.io/postcodes/${cleaned}`);
    const data = await resp.json();
    console.log("Postcodes.io response status:", data.status);
    if (data.status !== 200 || !data.result) {
      return new Response(JSON.stringify({ error: 'Postcode not found' }), { status: 404 });
    }

    const { latitude, longitude } = data.result;
    console.log("Got lat/lng:", latitude, longitude);

    // Update user_profiles with location point and timestamp
    const pointWKT = `POINT(${longitude} ${latitude})`;
    console.log("Updating user_profiles for user:", userId);
    const { error: upErr } = await supabase
      .from('user_profiles')
      .update({
        postcode: cleaned,
        location: pointWKT,
        location_resolved_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (upErr) {
      console.error("Profile update failed:", upErr.message);
      return new Response(JSON.stringify({ error: 'Profile update failed', detail: upErr.message }), { status: 500 });
    }

    // Fetch nearby locations via RPC
    console.log("Calling get_nearby_locations RPC");
    const { data: nearby, error: locErr } = await supabase.rpc('get_nearby_locations', {
      p_user_id: userId,
      p_radius_meters: RADIUS_METERS
    });

    if (locErr) {
      console.warn("RPC error:", locErr.message);
      return new Response(JSON.stringify({
        message: 'Geocoded successfully, but nearby locations RPC not found. Create get_nearby_locations.',
      }), { status: 200 });
    }

    console.log("Nearby locations count:", nearby?.length);

    // Compute scores and upsert top 10
    const ranked = (nearby as Array<{ id: number; size_category: string; distance_meters: number }>)
      .map(r => {
        const miles = r.distance_meters / METERS_PER_MILE;
        const rounded = roundToHalfMiles(miles);
        const score = sizePoints(r.size_category) * (1 / rounded);
        return { ...r, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    console.log("Ranked allocations count:", ranked.length);

    await supabase.from('location_allocation').delete().eq('user_id', userId);
    const { error: insErr } = await supabase
      .from('location_allocation')
      .insert(
        ranked.map(r => ({
          user_id: userId,
          location_id: r.id,
          score: r.score,
        }))
      );

    if (insErr) {
      console.error("Insert allocations failed:", insErr.message);
      return new Response(JSON.stringify({ error: 'Failed to insert allocations', detail: insErr.message }), { status: 500 });
    }

    console.log("Function completed successfully");
    return new Response(JSON.stringify({
      message: 'Postcode geocoded and allocations updated',
      latitude,
      longitude,
      allocated_count: ranked.length
    }), { status: 200 });

  } catch (e: any) {
    console.error("Unhandled error:", e);
    return new Response(JSON.stringify({ error: 'Unhandled error', detail: String(e?.message ?? e) }), { status: 500 });
  }
}
