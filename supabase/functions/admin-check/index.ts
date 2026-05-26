import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type AdminCheckResponse = {
  isAdmin: boolean;
  user: {
    id: string;
    email: string | null;
  };
  role: "admin" | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getBearerToken = (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  const match = authHeader?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

/*
Admin role sanity check:

select
  au.email,
  p.role as product_role,
  ur.role as system_role,
  public.has_role(au.id, 'admin'::public.app_role) as has_admin_role
from auth.users au
left join public.profiles p on p.user_id = au.id
left join public.user_roles ur on ur.user_id = au.id
where lower(au.email) = lower('admin@vet-platform.com');

Expected:
product_role = learner
system_role = admin
has_admin_role = true
*/

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const jwt = getBearerToken(req);
    if (!jwt) {
      return json({ error: "Missing bearer token" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return json({ error: "Server env not configured" }, 500);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
    const user = userData.user;

    if (userError || !user) {
      return json({ error: "Invalid token" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleRow, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      console.error("admin-check role lookup error:", roleError);
      return json({ error: roleError.message }, 500);
    }

    const response: AdminCheckResponse = {
      isAdmin: roleRow?.role === "admin",
      user: {
        id: user.id,
        email: user.email ?? null,
      },
      role: roleRow?.role === "admin" ? "admin" : null,
    };

    return json(response);
  } catch (e) {
    console.error("admin-check error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
