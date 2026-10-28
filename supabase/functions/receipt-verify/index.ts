// One-time receipt verification API. Deploy only after the staged migration.
// Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY.
// Public lookup reveals only status and receipt code; redemption requires owner's JWT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.10";

const cors = {
  "access-control-allow-origin": "https://cuncun.icu",
  "access-control-allow-headers": "authorization, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "content-type": "application/json; charset=utf-8",
};
const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });
const bytesToHex = (bytes: Uint8Array) => Array.from(bytes, x => x.toString(16).padStart(2, "0")).join("");
const hash = async (token: string) => bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))));
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
async function actor(req: Request) {
  const header = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(header)) return null;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(header.replace(/^Bearer\s+/i, ""));
  return error ? null : data.user;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return respond({ error: "method_not_allowed" }, 405);
  try {
    const body = await req.json();
    const action = String(body?.action || "");
    if (!["issue", "check", "redeem"].includes(action)) return respond({ error: "invalid_action" }, 400);
    if (action === "issue") {
      const user = await actor(req);
      if (!user) return respond({ error: "unauthorized" }, 401);
      const code = String(body.receipt_code || "");
      const snapshot = body.receipt_snapshot;
      if (!/^[A-Za-z0-9_-]{6,80}$/.test(code) || !snapshot || typeof snapshot !== "object" || Array.isArray(snapshot) || JSON.stringify(snapshot).length > 16000) return respond({ error: "invalid_receipt" }, 400);
      const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
      const { error } = await db.from("receipt_verifications").insert({ owner_user_id: user.id, receipt_code: code, receipt_snapshot: snapshot, token_hash: await hash(token) });
      if (error) return respond({ error: error.code === "23505" ? "receipt_already_exists" : "issue_failed" }, error.code === "23505" ? 409 : 500);
      return respond({ receipt_code: code, token }); // Return once; never store raw token.
    }
    const token = String(body.token || "");
    if (!/^[a-f0-9]{64}$/.test(token)) return respond({ error: "invalid_token" }, 400);
    const token_hash = await hash(token);
    if (action === "check") {
      const { data, error } = await db.from("receipt_verifications").select("receipt_code,status,issued_at,redeemed_at").eq("token_hash", token_hash).maybeSingle();
      if (error) return respond({ error: "lookup_failed" }, 500);
      if (!data) return respond({ error: "not_found" }, 404);
      return respond(data);
    }
    const user = await actor(req);
    if (!user) return respond({ error: "unauthorized" }, 401);
    // Atomic conditional update: only the first concurrent redemption can succeed.
    const { data, error } = await db.from("receipt_verifications")
      .update({ status: "redeemed", redeemed_at: new Date().toISOString(), redeemed_by: user.id })
      .eq("token_hash", token_hash).eq("owner_user_id", user.id).eq("status", "active")
      .select("receipt_code,redeemed_at").maybeSingle();
    if (error) return respond({ error: "redeem_failed" }, 500);
    if (!data) return respond({ error: "not_active_or_not_owned" }, 409);
    return respond({ status: "redeemed", ...data });
  } catch {
    return respond({ error: "invalid_request" }, 400);
  }
});
