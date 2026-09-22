import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: Record<string, unknown>) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
);

function getSecretKey() {
  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyKey) return legacyKey;

  let secretKeyMap: Record<string, string> = {};
  try {
    secretKeyMap = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  } catch {
    return null;
  }
  const defaultSecretName = secretKeyMap.default;
  return defaultSecretName ? Deno.env.get(defaultSecretName) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const secretKey = getSecretKey();
    const authHeader = req.headers.get("Authorization");
    if (!supabaseUrl || !secretKey) return json(500, { error: "Portal management is not configured." });
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Please sign in again." });

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.slice("Bearer ".length);
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return json(401, { error: "Please sign in again." });

    const { data: staffUser } = await admin
      .from("staff_users")
      .select("auth_user_id")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();
    if (!staffUser) return json(403, { error: "Only Guardian Group staff can manage portal access." });

    const body = await req.json();
    const action = body.action || "provision";
    const companyId = String(body.companyId || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    if (!companyId) return json(400, { error: "A client is required." });

    const { data: company } = await admin
      .from("companies")
      .select("id, name")
      .eq("id", companyId)
      .maybeSingle();
    if (!company) return json(404, { error: "Client not found." });

    if (action === "disable") {
      const { error } = await admin
        .from("company_portal_accounts")
        .update({ auth_user_id: null, updated_at: new Date().toISOString() })
        .eq("company_id", companyId);
      if (error) throw error;
      return json(200, { success: true, message: "Portal access disabled." });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(400, { error: "Enter a valid portal email." });
    }

    const redirectTo = "https://app.guardiangroupsls.com/portal/set-password.html";
    let linkResult = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo,
        data: { company_id: company.id, company_name: company.name, account_type: "company_portal" },
      },
    });

    if (linkResult.error) {
      linkResult = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
    }

    if (linkResult.error || !linkResult.data?.user?.id || !linkResult.data.properties?.action_link) {
      throw linkResult.error || new Error("Could not create a setup link.");
    }

    const { error: saveError } = await admin
      .from("company_portal_accounts")
      .upsert({
        company_id: company.id,
        auth_user_id: linkResult.data.user.id,
        email,
        updated_at: new Date().toISOString(),
      }, { onConflict: "company_id" });
    if (saveError) throw saveError;

    return json(200, {
      success: true,
      email,
      setupLink: linkResult.data.properties.action_link,
      message: "Portal access is ready. Copy the secure setup link and send it to the client.",
    });
  } catch (error) {
    console.error("manage-company-portal", error);
    return json(500, { error: error instanceof Error ? error.message : "Something went wrong." });
  }
});
