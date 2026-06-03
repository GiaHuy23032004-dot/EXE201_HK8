import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

type UserAction =
  | "list_users"
  | "block_user"
  | "unblock_user"
  | "grant_admin"
  | "revoke_admin";

const productRole = (role: unknown) => (role === "mentor" ? "mentor" : "learner");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const jwt = getBearerToken(req);
    if (!jwt) {
      return json({ error: "Missing authorization token" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return json({ error: "Server env not configured" }, 500);
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await authClient.auth.getUser(jwt);
    const currentUser = userData.user;

    if (userError || !currentUser) {
      return json({ error: "Invalid authorization token" }, 401);
    }

    const { data: adminRole, error: adminRoleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (adminRoleError) {
      console.error("admin-user-actions admin role lookup error:", adminRoleError);
      return json({ error: adminRoleError.message }, 500);
    }

    if (adminRole?.role !== "admin") {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as UserAction | undefined;
    const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : null;
    const confirmed = body.confirmed === true;

    if (!action) {
      return json({ error: "Missing action" }, 400);
    }

    if (action === "list_users") {
      await adminClient.from("profiles").update({ role: "learner" }).eq("role", "admin");

      const { data: profiles, error: profilesError } = await adminClient
        .from("profiles")
        .select("user_id, name, username, email, avatar_url, role, created_at, is_blocked")
        .order("created_at", { ascending: false });

      if (profilesError) {
        throw profilesError;
      }

      const { data: roles, error: rolesError } = await adminClient
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) {
        throw rolesError;
      }

      const roleMap = new Map<string, Set<string>>();
      (roles ?? []).forEach((roleRow) => {
        const userRoles = roleMap.get(roleRow.user_id) ?? new Set<string>();
        userRoles.add(roleRow.role);
        roleMap.set(roleRow.user_id, userRoles);
      });

      const users = (profiles ?? []).map((profile) => ({
        user_id: profile.user_id,
        name: profile.name,
        username: profile.username,
        email: profile.email,
        avatar_url: profile.avatar_url,
        product_role: productRole(profile.role),
        role: productRole(profile.role),
        is_blocked: Boolean(profile.is_blocked),
        created_at: profile.created_at,
        roles: Array.from(roleMap.get(profile.user_id) ?? []),
        is_admin: roleMap.get(profile.user_id)?.has("admin") ?? false,
      }));

      return json({ users });
    }

    if (!targetUserId) {
      return json({ error: "Missing targetUserId" }, 400);
    }

    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from("profiles")
      .select("user_id, role, is_blocked")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (targetProfileError) {
      throw targetProfileError;
    }

    if (!targetProfile) {
      return json({ error: "User not found" }, 404);
    }

    if (targetProfile.role === "admin") {
      await adminClient.from("profiles").update({ role: "learner" }).eq("user_id", targetUserId);
    }

    const { data: adminRows, error: adminRowsError } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (adminRowsError) {
      throw adminRowsError;
    }

    const adminIds = new Set((adminRows ?? []).map((row) => row.user_id));
    const targetIsAdmin = adminIds.has(targetUserId);

    if (action === "block_user") {
      if (targetUserId === currentUser.id) {
        return json({ error: "Bạn không thể khóa chính mình." }, 400);
      }

      if (targetIsAdmin && !confirmed) {
        return json({ error: "Blocking another admin requires confirmation." }, 400);
      }

      const { error } = await adminClient
        .from("profiles")
        .update({ is_blocked: true })
        .eq("user_id", targetUserId);

      if (error) throw error;
      return json({ success: true, is_blocked: true });
    }

    if (action === "unblock_user") {
      const { error } = await adminClient
        .from("profiles")
        .update({ is_blocked: false })
        .eq("user_id", targetUserId);

      if (error) throw error;
      return json({ success: true, is_blocked: false });
    }

    if (action === "grant_admin") {
      const { error } = await adminClient
        .from("user_roles")
        .upsert({ user_id: targetUserId, role: "admin" }, { onConflict: "user_id,role" });

      if (error) throw error;
      return json({ success: true });
    }

    if (action === "revoke_admin") {
      if (targetUserId === currentUser.id) {
        return json({ error: "Bạn không thể thu hồi quyền Admin của chính mình." }, 400);
      }

      if (targetIsAdmin && adminIds.size <= 1) {
        return json({ error: "Không thể thu hồi Admin cuối cùng của hệ thống." }, 400);
      }

      const { error } = await adminClient
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId)
        .eq("role", "admin");

      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("admin-user-actions error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
