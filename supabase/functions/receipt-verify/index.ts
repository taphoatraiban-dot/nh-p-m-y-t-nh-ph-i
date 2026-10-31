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
    if (!["issue", "check", "redeem", "owner-access", "owner-result", "owner-history", "owner-open", "owner-detail", "owner-delete", "owner-delete-all", "owner-code-result", "owner-code-redeem", "public-result"].includes(action)) return respond({ error: "invalid_action" }, 400);
    if (action === "owner-detail" || action === "owner-delete" || action === "owner-delete-all") {
      const user = await actor(req);
      if (!user) return respond({ error: "unauthorized" }, 401);
      if (action === "owner-detail") {
        const code = String(body?.code || "");
        if (!/^CQ-[A-Z0-9-]{6,40}$/.test(code)) return respond({ error: "invalid_code" }, 400);
        const { data, error } = await db.from("receipt_verifications")
          .select("receipt_code,status,issued_at,redeemed_at,paid_amount_vnd,receipt_snapshot")
          .eq("owner_user_id",user.id).eq("receipt_code",code).maybeSingle();
        if (error) return respond({ error: "detail_failed" }, 500);
        if (!data) return respond({ error: "not_found" }, 404);
        return respond({ receipt: { code:data.receipt_code,status:data.status,issuedAt:data.issued_at,
          redeemedAt:data.redeemed_at,paidAmount:data.paid_amount_vnd,snapshot:data.receipt_snapshot } });
      }
      if (action === "owner-delete-all") {
        if (body?.confirmation !== "XOA TAT CA PHIEU VINH VIEN")
          return respond({ error:"confirmation_required" },400);
        // Bounded batches prevent unbounded request sizes and allow visible progress.
        const { data: batch, error: listError } = await db.from("receipt_verifications")
          .select("receipt_code").eq("owner_user_id",user.id)
          .order("id",{ascending:true}).limit(100);
        if (listError) return respond({error:"delete_list_failed"},500);
        if (!batch?.length) return respond({deletedCount:0,hasMore:false});
        const {data: deleted,error} = await db.from("receipt_verifications")
          .delete().eq("owner_user_id",user.id)
          .in("receipt_code",batch.map((r:any)=>r.receipt_code)).select("receipt_code");
        if (error) return respond({error:"delete_failed"},500);
        return respond({deletedCount:(deleted||[]).length,hasMore:batch.length===100});
      }
      const codes = body?.codes;
      if (!Array.isArray(codes) || codes.length < 1 || codes.length > 100 ||
          new Set(codes).size !== codes.length ||
          !codes.every((c:unknown)=>typeof c==="string" && /^CQ-[A-Z0-9-]{6,40}$/.test(c)))
        return respond({ error: "invalid_codes" }, 400);
      if (body?.confirmation !== "XOA VINH VIEN") return respond({ error: "confirmation_required" }, 400);
      // Delete only exact owner-owned receipts. Their QR hashes disappear too:
      // public checks return not_found, including previously redeemed receipts.
      const { data, error } = await db.from("receipt_verifications")
        .delete().eq("owner_user_id",user.id).in("receipt_code",codes).select("receipt_code");
      if (error) return respond({ error: "delete_failed" }, 500);
      return respond({ deletedCodes:(data||[]).map((r:any)=>r.receipt_code),deletedCount:(data||[]).length });
    }
    if (action === "owner-open") {
      const user = await actor(req);
      if (!user) return respond({ error: "unauthorized" }, 401);
      const page = Number(body?.page ?? 0);
      if (!Number.isSafeInteger(page) || page < 0 || page > 10000) return respond({ error: "invalid_page" }, 400);
      const size = 100;
      const { data, error } = await db.from("receipt_verifications")
        .select("receipt_code,issued_at,receipt_snapshot")
        .eq("owner_user_id", user.id).eq("status", "active")
        .order("issued_at", { ascending: false }).order("id", { ascending: false })
        .range(page * size, page * size + size);
      if (error) return respond({ error: "open_history_failed" }, 500);
      return respond({ page, hasMore: (data || []).length > size, receipts: (data || []).slice(0,size).map((row: any) => ({
        code: row.receipt_code,
        customer: String(row.receipt_snapshot?.customer || "").slice(0,100),
        drawDate: String(row.receipt_snapshot?.date || "").slice(0,20),
        issuedAt: row.issued_at
      })) });
    }
    if (action === "owner-history") {
      const user = await actor(req);
      if (!user) return respond({ error: "unauthorized" }, 401);
      const page = Number(body?.page ?? 0);
      if (!Number.isSafeInteger(page) || page < 0 || page > 10000)
        return respond({ error: "invalid_page" }, 400);
      const pageSize = 100;
      const start = page * pageSize;
      const { data, error } = await db.from("receipt_verifications")
        .select("receipt_code,status,issued_at,redeemed_at,receipt_snapshot,paid_amount_vnd")
        .eq("owner_user_id", user.id).eq("status", "redeemed")
        .order("redeemed_at", { ascending: false }).order("id", { ascending: false })
        .range(start, start + pageSize);
      if (error) return respond({ error: "history_failed" }, 500);
      return respond({ page, hasMore: (data || []).length > pageSize, receipts: (data || []).slice(0,pageSize).map((row: any) => ({
        code: row.receipt_code,
        customer: String(row.receipt_snapshot?.customer || "").slice(0,100),
        drawDate: String(row.receipt_snapshot?.date || "").slice(0,20),
        redeemedAt: row.redeemed_at,
        // Historical redemptions did not store a settled amount.
        payoutAmount: row.paid_amount_vnd == null ? null : Number(row.paid_amount_vnd)
      })) });
    }
    if (action === "issue") {
      const user = await actor(req);
      if (!user) return respond({ error: "unauthorized" }, 401);
      // Direct-print receipt: store the exact receipt snapshot before printing.
      const snapshot = body?.receipt;
      if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.items)
          || snapshot.items.length < 1 || snapshot.items.length > 150
          || typeof snapshot.total !== 'string'
          || typeof snapshot.date !== 'string'
          || JSON.stringify(snapshot).length > 16000) return respond({ error: "invalid_receipt" }, 400);
      // A newly issued QR must be independently payable from the frozen customer
      // rates. Never issue a seemingly valid QR with missing price metadata.
      const verification = snapshot.verificationSource;
      const payoutKeys = ["b2", "b3", "b4", "xc", "dd", "da2", "dathang", "daMB"];
      if (!verification || !String(verification.customerPriceKey || "").trim()
          || !Array.isArray(verification.pricedRows) || !verification.pricedRows.length
          || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(verification.drawDate || ""))
          || !verification.payoutRatesSnapshot
          || !payoutKeys.every(key => Number.isFinite(Number(verification.payoutRatesSnapshot[key]))
              && Number(verification.payoutRatesSnapshot[key]) > 0)) {
        return respond({ error: "missing_customer_price_snapshot" }, 400);
      }
      const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
      const code = "CQ-" + crypto.randomUUID().slice(0,12).toUpperCase();
      const { error } = await db.from("receipt_verifications").insert({
        owner_user_id: user.id, receipt_code: code, receipt_snapshot: snapshot,
        token_hash: await hash(token)
      });
      if (error) return respond({ error: "issue_failed" }, 500);
      return respond({ receipt_code: code, token }); // Return once; never store raw token.
    }
    if (action === "owner-code-redeem") {
      const user = await actor(req);
      if (!user) return respond({error:"unauthorized"},401);
      const code=String(body?.code||"");
      const amount=body?.paidAmountVnd;
      if (!/^CQ-[A-Z0-9-]{6,40}$/.test(code)) return respond({error:"invalid_code"},400);
      if (!Number.isSafeInteger(amount)||amount<0||amount>1000000000000) return respond({error:"invalid_paid_amount"},400);
      if (body?.confirmation !== "DA TRA THUONG") return respond({error:"confirmation_required"},400);
      const {data,error}=await db.from("receipt_verifications")
        .update({status:"redeemed",redeemed_at:new Date().toISOString(),redeemed_by:user.id,paid_amount_vnd:amount})
        .eq("owner_user_id",user.id).eq("receipt_code",code).eq("status","active")
        .select("receipt_code,redeemed_at,paid_amount_vnd").maybeSingle();
      if(error)return respond({error:"redeem_failed"},500);
      if(!data)return respond({error:"not_active_or_not_owned"},409);
      return respond({status:"redeemed",...data});
    }
    const token = String(body.token || "");
    if (action !== "owner-code-result" && !/^[a-f0-9]{64}$/.test(token)) return respond({ error: "invalid_token" }, 400);
    const token_hash = action === "owner-code-result" ? "" : await hash(token);
    if (action === "check") {
      const { data, error } = await db.from("receipt_verifications").select("receipt_code,status,issued_at,redeemed_at,receipt_snapshot").eq("token_hash", token_hash).maybeSingle();
      if (error) return respond({ error: "lookup_failed" }, 500);
      if (!data) return respond({ error: "not_found" }, 404);
      // QR token is a bearer capability: disclose only receipt display fields, never customer or verificationSource.
      const original = data.receipt_snapshot && typeof data.receipt_snapshot === "object" ? data.receipt_snapshot : {};
      const safeText = (value: unknown) => typeof value === "string" ? value.slice(0,180) : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
      const items = Array.isArray(original.items) ? original.items.slice(0,150).map((item: any) => ({
        station: safeText(item?.station), region: safeText(item?.region),
        number: safeText(item?.number), content: safeText(item?.content),
        type: safeText(item?.type), points: safeText(item?.points), amount: safeText(item?.amount)
      })) : [];
      return respond({ receipt_code: data.receipt_code, status: data.status, issued_at: data.issued_at, redeemed_at: data.redeemed_at,
        receipt: { date: safeText(original.date), time: safeText(original.time), items,
          total: safeText(original.total), totalLabel: safeText(original.totalLabel) } });
    }
    const publicResult = action === "public-result";
    const user = publicResult ? null : await actor(req);
    if (!publicResult && !user) return respond({ error: "unauthorized" }, 401);
    if (action === "owner-access" || action === "owner-result" || action === "owner-code-result" || publicResult) {
      let lookup = db.from("receipt_verifications")
        .select("receipt_code,status,receipt_snapshot");
      if(action==="owner-code-result"){
        const code=String(body?.code||"");
        if(!/^CQ-[A-Z0-9-]{6,40}$/.test(code))return respond({error:"invalid_code"},400);
        lookup=lookup.eq("receipt_code",code);
      }else lookup=lookup.eq("token_hash",token_hash);
      if (!publicResult) lookup = lookup.eq("owner_user_id", user!.id);
      const { data: owned, error: ownedError } = await lookup.maybeSingle();
      if (ownedError) return respond({ error: "lookup_failed" }, 500);
      if (!owned) return respond({ error: "forbidden" }, 403);
      if (action === "owner-access") return respond({ allowed: true });
      // Do not calculate or disclose payouts without a verified draw result and
      // the immutable payout rates attached at issuance.
      const source = owned.receipt_snapshot?.verificationSource;
      if (!source?.rawText || !source?.drawDate || !Array.isArray(source?.pricedRows)) {
        return respond({ allowed: true, ready: false,
          message: "Phiếu chưa có đủ dữ liệu cược hoặc ngày quay để dò kết quả." });
      }
      const date = String(source.drawDate);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return respond({ allowed: true, ready: false, message: "Ngày quay không hợp lệ." });
      }
      const { data: draws, error: drawError } = await db.from("lottery_results")
        .select("region,draw_date,source,data").eq("draw_date", date).limit(20);
      if (drawError) return respond({ error: "results_lookup_failed" }, 500);
      const requiredCounts: Record<string, Record<string, number>> = {
        MN: {db:1,g1:1,g2:1,g3:2,g4:7,g5:1,g6:3,g7:1,g8:1},
        MT: {db:1,g1:1,g2:1,g3:2,g4:7,g5:1,g6:3,g7:1,g8:1},
        MB: {db:1,g1:1,g2:2,g3:6,g4:4,g5:6,g6:3,g7:4}
      };
      const coverage = (draws || []).map(draw => {
        const region = String(draw.region || "").toUpperCase();
        const required = requiredCounts[region];
        const stations = Array.isArray(draw.data?.data) ? draw.data.data : [];
        const checked = stations.map((station: any) => {
          const prizes = station?.prizes || {};
          const complete = !!required && Object.entries(required).every(([key, count]) =>
            Array.isArray(prizes[key]) && prizes[key].length === count &&
            prizes[key].every((v: unknown) => typeof v === "string" && /^[0-9]+$/.test(v)));
          return { station: String(station?.province || ""), complete };
        });
        return { region, complete: draw.data?.success === true && checked.length > 0 &&
          checked.every((station: {complete:boolean}) => station.complete), stations: checked };
      });
      const normalizeStation = (name: unknown) => String(name || "").normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").replace(/đ/g,"d").replace(/Đ/g,"D")
        .toLowerCase().replace(/[^a-z0-9]/g,"");
      const aliases: Record<string,string> = {
        tpho:"hochiminh",hcm:"hochiminh",tphcm:"hochiminh",sg:"hochiminh",tphochiminh:"hochiminh",
        dt:"dongthap",cmau:"camau",btre:"bentre",vtau:"bariavungtau",
        dnai:"dongnai",ctho:"cantho",st:"soctrang",tn:"tayninh",
        ag:"angiang",bt:"binhthuan",vl:"vinhlong",bd:"binhduong",
        tv:"travinh",tg:"tiengiang",kg:"kiengiang",lan:"longan",
        bphuoc:"binhphuoc",hgiang:"haugiang",blieu:"baclieu",
        dlak:"daklak",qnam:"quangnam",dnang:"danang",kh:"khanhhoa",
        bdinh:"binhdinh",qtri:"quangtri",glai:"gialai",nthuan:"ninhthuan",
        qngai:"quangngai",ktum:"kontum",hue:"thuathienhue",
        qb:"quangbinh",hn:"mienbac",mb:"mienbac",hanoi:"mienbac",
        hanoibac:"mienbac",mienbac:"mienbac",bac:"mienbac"
      };
      const stationCoverage = (Array.isArray(source.pricedRows) ? source.pricedRows : []).map((row: any) => {
        const region = row?.region === "N" ? "MN" : row?.region === "T" ? "MT" : "MB";
        // Multi-station wagers must validate every selected station, including B3/B4/XC.
        const selected = Array.isArray(row?.crossProvinces) ? row.crossProvinces.filter((s: unknown) => typeof s === "string" && s.trim()) : [];
        const multi = row?.cross2 === true && selected.length >= 2 && !row?.scopeStation;
        const names = multi ? selected : [row?.scopeStation || row?.station];
        const matches = names.map((name: unknown) => {
          const normalized = normalizeStation(name);
          const canonical = aliases[normalized] || normalized;
          const found = coverage.find(c => c.region === region)?.stations.find(
            (station: {station:string;complete:boolean}) => {
              const actual = aliases[normalizeStation(station.station)] || normalizeStation(station.station);
              return actual === canonical || (canonical === "thuathienhue" && actual === "hue");
            });
          return { requested: String(name || ""), matched: found?.station || null, complete: found?.complete === true };
        });
        return { region, type: String(row?.type || ""), stations: matches,
          ready: matches.length > 0 && matches.every(m => m.complete) };
      });
      // Diagnostic-only match counts. Never declare a winning ticket until every
      // bet type, station and immutable payout rate has been verified.
      const safeSuffix = (value: unknown, digits: number) => {
        const n = String(value ?? "");
        return /^[0-9]+$/.test(n) && n.length >= digits ? n.slice(-digits) : null;
      };
      const matchDiagnostics = (Array.isArray(source.pricedRows) ? source.pricedRows : []).map((row: any, index: number) => {
        const region = row?.region === "N" ? "MN" : row?.region === "T" ? "MT" : "MB";
        const type = String(row?.type || "").toUpperCase();
        const digits = type === "B2" || type === "BL2" ? 2 : type === "B3" || type === "BL3" ? 3 : type === "B4" || type === "BL4" ? 4 : 0;
        const numbers = Array.isArray(row?.numbers) ? row.numbers.map(String) : [];
        const stationStatus = stationCoverage[index];
        if (!digits || !stationStatus?.ready || numbers.some(n => !/^[0-9]+$/.test(n) || n.length !== digits)) {
          return { index, type, supported: false, reason: "pending_type_or_station_validation" };
        }
        const eligibleKeys = region === "MB" ? (digits === 3 ? ["db","g1","g2","g3","g4","g5","g6"] :
          digits === 4 ? ["db","g1","g2","g3","g4","g5"] : ["db","g1","g2","g3","g4","g5","g6","g7"]) :
          digits === 3 ? ["db","g1","g2","g3","g4","g5","g6","g7"] :
          digits === 4 ? ["db","g1","g2","g3","g4","g5","g6"] :
          ["db","g1","g2","g3","g4","g5","g6","g7","g8"];
        const matched = stationStatus.stations.flatMap((station: {matched:string|null}) => {
          const draw = (draws || []).find(d => String(d.region).toUpperCase() === region);
          const province = (Array.isArray(draw?.data?.data) ? draw.data.data : []).find((p: any) => p.province === station.matched);
          return numbers.map(number => ({
            number, station: station.matched,
            count: eligibleKeys.reduce((total,key) => total +
              (Array.isArray(province?.prizes?.[key]) ? province.prizes[key].filter(
                (prize: unknown) => safeSuffix(prize,digits) === number).length : 0),0)
          }));
        });
        return { index, type, supported: true, diagnosticOnly: true, matches: matched };
      });
      const specialDiagnostics = (Array.isArray(source.pricedRows) ? source.pricedRows : []).map((row: any, index: number) => {
        const type = String(row?.type || "").toUpperCase();
        const keys = ["XC","XC-ĐẦU","XC-ĐUÔI","DD","ĐẦU","ĐUÔI"];
        if (!keys.includes(type) || !stationCoverage[index]?.ready)
          return { index, type, supported: false };
        const region = row?.region === "N" ? "MN" : row?.region === "T" ? "MT" : "MB";
        const isNorth = region === "MB";
        const prizeKeys = type === "XC" ? [isNorth ? "g6" : "g7","db"] :
          type === "XC-ĐẦU" ? [isNorth ? "g6" : "g7"] :
          type === "XC-ĐUÔI" ? ["db"] :
          type === "DD" ? [isNorth ? "g7" : "g8","db"] :
          type === "ĐẦU" ? [isNorth ? "g7" : "g8"] : ["db"];
        const digits = type.startsWith("XC") ? 3 : 2;
        const numbers = Array.isArray(row.numbers) ? row.numbers.map(String) : [];
        if (numbers.length === 0 || numbers.some(n => !/^[0-9]+$/.test(n) || n.length !== digits))
          return { index, type, supported: false };
        const draw = (draws || []).find(d => String(d.region).toUpperCase() === region);
        const matches = stationCoverage[index].stations.flatMap((station: {matched:string|null}) => {
          const province = (Array.isArray(draw?.data?.data) ? draw.data.data : []).find((p: any) => p.province === station.matched);
          return numbers.map(number => ({
            station: station.matched, number,
            count: prizeKeys.reduce((sum,key) => sum + (Array.isArray(province?.prizes?.[key])
              ? province.prizes[key].filter((v: unknown) => safeSuffix(v,digits) === number).length : 0),0)
          }));
        });
        return { index, type, supported: true, diagnosticOnly: true, matches };
      });
      const daDiagnostics = (Array.isArray(source.pricedRows) ? source.pricedRows : []).map((row: any, index: number) => {
        if (String(row?.type || "").toUpperCase() !== "DA" || !stationCoverage[index]?.ready)
          return { index, supported: false };
        const region = row.region === "N" ? "MN" : row.region === "T" ? "MT" : "MB";
        const numbers = Array.isArray(row.numbers) ? [...new Set(row.numbers.map(String))] : [];
        if (numbers.length < 2 || numbers.some(n => !/^[0-9]{2}$/.test(n)))
          return { index, supported: false, reason: "invalid_pair_numbers" };
        const draw = (draws || []).find(d => String(d.region).toUpperCase() === region);
        const perStation = stationCoverage[index].stations.map((station: {matched:string|null}) => {
          const province = (Array.isArray(draw?.data?.data) ? draw.data.data : []).find((p: any) => p.province === station.matched);
          const prizes = province?.prizes || {};
          const counts = Object.entries(prizes).flatMap(([key,values]) =>
            (region === "MB" && key === "g8") ? [] :
            Array.isArray(values) ? values.map(v => safeSuffix(v,2)).filter(Boolean) : []);
          return { station: station.matched, hits: numbers.map(number => ({
            number, count: counts.filter(n => n === number).length
          })) };
        });
        const cross = row.cross2 === true || row.daMode === "cross" || (Array.isArray(row.crossProvinces) && row.crossProvinces.length === 2);
        if (cross && perStation.length !== 2)
          return { index, supported: false, reason: "cross_requires_two_stations" };
        if (!cross && perStation.length !== 1)
          return { index, supported: false, reason: "straight_requires_one_station" };
        const pairs = [];
        for (let i=0;i<numbers.length;i++) for (let j=i+1;j<numbers.length;j++) {
          const a=numbers[i], b=numbers[j];
          const first=perStation[0].hits.find(h => h.number === a)?.count || 0;
          const second=perStation[0].hits.find(h => h.number === b)?.count || 0;
          const times=cross ? (
            first * (perStation[1].hits.find(h => h.number === b)?.count || 0) +
            second * (perStation[1].hits.find(h => h.number === a)?.count || 0)
          ) : first * second;
          if (times > 0) pairs.push({ a,b,times });
        }
        return { index, supported: true, diagnosticOnly: true, cross, stations: perStation, pairs };
      });
      return respond({ allowed: !publicResult, ready: false,
        source: publicResult ? { pricedRows: source.pricedRows, drawDate: date, payoutRatesSnapshot: source.payoutRatesSnapshot } :
          { rawText: source.rawText, totalGross: source.totalGross, finalTotal: source.finalTotal, pricedRows: source.pricedRows, drawDate: date, payoutRatesSnapshot: source.payoutRatesSnapshot, payoutRatesSnapshotVersion: source.payoutRatesSnapshotVersion },
        drawDate: date,
        resultSources: (draws || []).map(d => ({ region: d.region, source: d.source })),
        resultCoverage: coverage,
        stationCoverage,
        matchDiagnostics,
        specialDiagnostics,
        daDiagnostics,
        message: draws?.length
          ? "Đã tìm thấy dữ liệu kết quả theo ngày. Chưa đối chiếu đủ từng đài và loại cược để tính thưởng an toàn."
          : "Chưa có dữ liệu kết quả xổ số cho ngày quay của phiếu." });
    }
    // The owner must explicitly confirm the amount actually paid, in VND.
    // This is not inferred from a historical receipt or a mutable price table.
    const amount = body?.paidAmountVnd;
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000000000000)
      return respond({ error: "invalid_paid_amount" }, 400);
    // Atomic conditional update: only the first concurrent redemption can succeed.
    const { data, error } = await db.from("receipt_verifications")
      .update({ status: "redeemed", redeemed_at: new Date().toISOString(), redeemed_by: user.id, paid_amount_vnd: amount })
      .eq("token_hash", token_hash).eq("owner_user_id", user.id).eq("status", "active")
      .select("receipt_code,redeemed_at,paid_amount_vnd").maybeSingle();
    if (error) return respond({ error: "redeem_failed" }, 500);
    if (!data) return respond({ error: "not_active_or_not_owned" }, 409);
    return respond({ status: "redeemed", ...data });
  } catch {
    return respond({ error: "invalid_request" }, 400);
  }
});
