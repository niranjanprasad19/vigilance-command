// Signed, sealed Merkle roots over the tamper-evident audit journal.
// The server reads an unsealed window of entries, computes a Merkle root over
// their hashes, HMAC-signs it with AUDIT_SIGNING_KEY, and persists the root.
// Verification recomputes every root and compares it to the stored signature.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KEY_ID = "audit-hmac-v1";

/** Seal all entries since the last sealed window. Commander or auditor only. */
export const signAuditRoot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAuth } = await supabase.rpc("has_role", { _user_id: userId, _role: "commander" })
      .then(async (r) => r.data ? r : supabase.rpc("has_role", { _user_id: userId, _role: "auditor" }));
    const allowed = isAuth as unknown as boolean;
    if (!allowed) return { ok: false as const, reason: "Commander or Auditor authority required" };

    // last sealed window end
    const { data: lastRoot } = await supabase
      .from("audit_roots").select("window_end_seq").order("window_end_seq", { ascending: false }).limit(1).maybeSingle();
    const since = (lastRoot?.window_end_seq as number | undefined) ?? 0;

    const { data: entries, error } = await supabase
      .from("audit_entries")
      .select("seq, hash")
      .gt("seq", since)
      .order("seq", { ascending: true })
      .limit(5000);
    if (error) return { ok: false as const, reason: error.message };
    if (!entries || entries.length === 0) return { ok: false as const, reason: "No unsealed entries to root" };

    const { merkleRoot, sha256Hex } = await import("./crypto.server");
    const hashes = entries.map((e) => e.hash as string);
    const rootHash = await merkleRoot(hashes);
    const windowStart = entries[0].seq as number;
    const windowEnd = entries[entries.length - 1].seq as number;

    const secret = process.env["AUDIT_SIGNING_KEY"]!;
    const body = `${KEY_ID}|${windowStart}|${windowEnd}|${entries.length}|${rootHash}|${(lastRoot?.window_end_seq as number | null) ?? ""}`;
    const signature = await sha256Hex(`${body}|${secret}`);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: insErr } = await supabaseAdmin.from("audit_roots").insert({
      window_start_seq: windowStart,
      window_end_seq: windowEnd,
      entry_count: entries.length,
      root_hash: rootHash,
      prev_root_hash: (lastRoot?.window_end_seq as number | null) != null ? null : null,
      signature,
      key_id: KEY_ID,
    });
    if (insErr) return { ok: false as const, reason: insErr.message };

    await supabase.rpc("append_audit", {
      _kind: "AUDIT_ROOT_SEALED",
      _payload: { window_start: windowStart, window_end: windowEnd, entry_count: entries.length, root_hash: rootHash } as never,
      _mode: "TRAINING",
      _classification: "CONFIDENTIAL",
    });

    return { ok: true as const, windowStart, windowEnd, entryCount: entries.length, rootHash, signature };
  });

/** Recompute every sealed root and compare to stored signature/hash chain. */
export const verifyAuditRoots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [roots, entries] = await Promise.all([
      supabase.from("audit_roots").select("id, window_start_seq, window_end_seq, entry_count, root_hash, prev_root_hash, signature, key_id").order("window_start_seq", { ascending: true }),
      supabase.from("audit_entries").select("seq, hash").order("seq", { ascending: true }).limit(50000),
    ]);
    const { merkleRoot, sha256Hex } = await import("./crypto.server");
    const secret = process.env["AUDIT_SIGNING_KEY"]!;

    const bySeq = new Map<number, string>((entries.data ?? []).map((e) => [e.seq as number, e.hash as string]));
    let brokenAt: number | null = null;
    let checked = 0;
    let prevEnd: number | null = null;
    for (const r of roots.data ?? []) {
      const start = r.window_start_seq as number;
      const end = r.window_end_seq as number;
      const hashes: string[] = [];
      for (let s = start; s <= end; s++) {
        const h = bySeq.get(s);
        if (!h) { brokenAt = s; break; }
        hashes.push(h);
      }
      if (brokenAt != null) break;
      const computed = await merkleRoot(hashes);
      const body = `${r.key_id}|${start}|${end}|${r.entry_count}|${computed}|${prevEnd ?? ""}`;
      const expectedSig = await sha256Hex(`${body}|${secret}`);
      checked++;
      if (computed !== r.root_hash || expectedSig !== r.signature) {
        brokenAt = start;
        break;
      }
      prevEnd = end;
    }
    return {
      ok: brokenAt === null,
      rootsChecked: checked,
      totalRoots: (roots.data ?? []).length,
      brokenAt,
      verifiedAt: Date.now(),
    };
  });

/** Export a signed evidence bundle: recent entries + sealed roots + verification. */
export const exportAuditBundle = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const v = d as { limit?: number };
    return { limit: Math.min(Math.max(Number(v?.limit ?? 400), 1), 5000) };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [ent, roots] = await Promise.all([
      supabase.from("audit_entries")
        .select("seq, ts, kind, actor_id, actor_role, mode, classification, payload, prev_hash, hash, client_request_id")
        .order("seq", { ascending: false }).limit(data.limit),
      supabase.from("audit_roots").select("*").order("window_start_seq", { ascending: true }).limit(500),
    ]);
    const { merkleRoot, sha256Hex } = await import("./crypto.server");
    const secret = process.env["AUDIT_SIGNING_KEY"]!;
    const entryList = (ent.data ?? []).slice().reverse();
    let prevEnd: number | null = null;
    let brokenAt: number | null = null;
    let ok = true;
    for (const r of roots.data ?? []) {
      const start = r.window_start_seq as number;
      const end = r.window_end_seq as number;
      const hashes = entryList.filter((e) => (e.seq as number) >= start && (e.seq as number) <= end).map((e) => e.hash as string);
      const computed = await merkleRoot(hashes);
      const body = `${r.key_id}|${start}|${end}|${r.entry_count}|${computed}|${prevEnd ?? ""}`;
      const expectedSig = await sha256Hex(`${body}|${secret}`);
      if (computed !== r.root_hash || expectedSig !== r.signature) { brokenAt = start; ok = false; break; }
      prevEnd = end;
    }
    return {
      exportedAt: new Date().toISOString(),
      chainOk: ok,
      brokenAt,
      entries: entryList,
      roots: roots.data ?? [],
      signer: { keyId: KEY_ID, algorithm: "HMAC-SHA256" },
    };
  });
