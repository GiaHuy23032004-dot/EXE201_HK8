import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-admin-seed-secret, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "admin@vet-platform.com";
const ADMIN_USERNAME = "admin";
const ADMIN_NAME = "VET Administrator";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const seedSecret = Deno.env.get("ADMIN_SEED_SECRET");
    if (!seedSecret || req.headers.get("x-admin-seed-secret") !== seedSecret) {
      return json({ error: "Admin seed is disabled" }, 403);
    }

    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    if (!adminPassword) {
      return json({ error: "ADMIN_PASSWORD is not configured" }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRole) {
      return json({ error: "Server env not configured" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRole);

    const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers();
    if (listError) throw listError;

    let user = existingUsers?.users?.find((existingUser) => existingUser.email === ADMIN_EMAIL);

    if (!user) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: adminPassword,
        email_confirm: true,
        user_metadata: {
          full_name: ADMIN_NAME,
          username: ADMIN_USERNAME,
          role: "learner",
        },
      });

      if (createError) throw createError;
      user = created.user!;
    }

    await admin
      .from("profiles")
      .update({ username: ADMIN_USERNAME, name: ADMIN_NAME, role: "learner" })
      .eq("user_id", user.id);

    const { error: roleError } = await admin
      .from("user_roles")
      .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });

    if (roleError) throw roleError;

    return json({
      success: true,
      user: {
        id: user.id,
        email: user.email ?? ADMIN_EMAIL,
      },
      role: "admin",
    });
  } catch (e) {
    console.error("admin-seed error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
