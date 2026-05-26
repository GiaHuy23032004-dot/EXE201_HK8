import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const allowedSystemRoles = new Set(["admin", "moderator", "user"]);

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const jwt = getBearerToken(req);
    if (!jwt) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRole) {
      return json({ error: "Server env not configured" }, 500);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
    const user = userData.user;

    if (userError || !user) {
      return json({ error: "Invalid token" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRole);

    const { data: myRole, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      console.error("admin-users role lookup error:", roleError);
      return json({ error: roleError.message }, 500);
    }

    if (myRole?.role !== "admin") {
      return json({ error: "Forbidden" }, 403);
    }

    const { action, targetUserId, role } = await req.json().catch(() => ({}));

    if (action === "list") {
      const { data: profiles, error: profileError } = await adminClient
        .from("profiles")
        .select("user_id, name, email, role, created_at, is_blocked")
        .order("created_at", { ascending: false })
        .limit(200);

      if (profileError) throw profileError;

      const { data: roles, error: rolesError } = await adminClient
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const roleMap = new Map<string, string[]>();
      (roles || []).forEach((roleRow) => {
        const userRoles = roleMap.get(roleRow.user_id) || [];
        userRoles.push(roleRow.role);
        roleMap.set(roleRow.user_id, userRoles);
      });

      const users = (profiles || []).map((profile) => ({
        ...profile,
        roles: roleMap.get(profile.user_id) || [],
      }));

      return json({ users });
    }

    if (!targetUserId) {
      return json({ error: "Missing targetUserId" }, 400);
    }

    if (action === "toggle-block") {
      const { data: profile, error: profileError } = await adminClient
        .from("profiles")
        .select("is_blocked")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        return json({ error: "User not found" }, 404);
      }

      const next = !profile.is_blocked;
      const { error: updateErr } = await adminClient
        .from("profiles")
        .update({ is_blocked: next })
        .eq("user_id", targetUserId);

      if (updateErr) throw updateErr;

      return json({ success: true, is_blocked: next });
    }

    if (action === "assign-role") {
      if (!role || !allowedSystemRoles.has(role)) {
        return json({ error: "Invalid role" }, 400);
      }

      const { error: insertErr } = await adminClient
        .from("user_roles")
        .upsert({ user_id: targetUserId, role }, { onConflict: "user_id,role" });

      if (insertErr) throw insertErr;

      return json({ success: true });
    }

    if (action === "remove-role") {
      if (!role || !allowedSystemRoles.has(role)) {
        return json({ error: "Invalid role" }, 400);
      }

      const { error: deleteErr } = await adminClient
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId)
        .eq("role", role);

      if (deleteErr) throw deleteErr;

      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (e) {
    console.error("admin-users error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
