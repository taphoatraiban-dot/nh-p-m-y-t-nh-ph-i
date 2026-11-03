// CUNCUN account deletion preflight. No destructive operations in this endpoint.
// A deletion endpoint must not be activated until database and VPS cleanup
// can be performed and verified end-to-end.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
const cors = { "access-control-allow-origin": "https://cuncun.icu", "access-control-allow-headers": "authorization,apikey,content-type", "access-control-allow-methods": "POST,OPTIONS", "content-type": "application/json" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const caller = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: identity, error: authError } = await caller.auth.getUser();
  if (authError || !identity.user) return json({ error: "Invalid session" }, 401);
  const admin = createClient(url, service);
  const { data: adminRow, error: adminError } = await admin.from("admin_users").select("user_id").eq("user_id", identity.user.id).maybeSingle();
  if (adminError || !adminRow) return json({ error: "Admin only" }, 403);
  let body: { user_id?: string, action?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (body.action !== "preflight" || !/^[0-9a-f-]{36}$/i.test(body.user_id || "")) return json({ error: "Invalid preflight request" }, 400);
  if (body.user_id === identity.user.id) return json({ error: "Cannot delete own admin account" }, 403);
  const { data: protectedAdmin } = await admin.from("admin_users").select("user_id").eq("user_id", body.user_id!).maybeSingle();
  if (protectedAdmin) return json({ error: "Protected admin account" }, 403);
  const { data: target, error: targetError } = await admin.auth.admin.getUserById(body.user_id!);
  if (targetError || !target.user) return json({ error: "Account not found" }, 404);
  const tables = ["devices", "email_licenses", "phone_auth_accounts", "printed_phoi", "print_queue", "telegram_member_groups", "telegram_member_messages", "telegram_member_sync_keys", "telegram_tenant_groups", "telegram_tenant_messages"];
  const counts: Record<string, number | null> = {};
  for (const table of tables) {
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true }).eq("user_id", body.user_id!);
    counts[table] = error ? null : count;
  }
  return json({ ok: true, target_user_id: target.user.id, counts, deletion_enabled: false, reason: "VPS Telegram session cleanup and transactional full-data deletion must be implemented and tested before enabling." });
});
