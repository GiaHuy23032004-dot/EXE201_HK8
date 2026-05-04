import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "admin@vet.local";
const ADMIN_PASSWORD = "Admin@VET2026";
const ADMIN_USERNAME = "admin";
const ADMIN_NAME = "VET Administrator";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRole);

    // Check if admin email already exists
    const { data: existing } = await admin.auth.admin.listUsers();
    let user = existing?.users?.find((u) => u.email === ADMIN_EMAIL);

    if (!user) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: ADMIN_NAME,
          username: ADMIN_USERNAME,
          role: "admin",
        },
      });
      if (createErr) throw createErr;
      user = created.user!;
    }

    // Ensure profile has username/admin role text
    await admin
      .from("profiles")
      .update({ username: ADMIN_USERNAME, name: ADMIN_NAME, role: "admin" })
      .eq("user_id", user.id);

    // Ensure admin role row exists
    await admin
      .from("user_roles")
      .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });

    return new Response(
      JSON.stringify({
        success: true,
        credentials: {
          username: ADMIN_USERNAME,
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
        },
        message: "Admin account ready",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("admin-seed error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
