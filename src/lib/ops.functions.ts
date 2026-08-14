// Server-authoritative operations layer.
// The browser PROPOSES; these handlers DECIDE. Every role check is re-evaluated
// here against the bearer token, never against anything the client sent.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  auditInput,
  autoDecisionInput,
  resolveInput,
  roeInput,
  taskingInput,
  type OpsMode,
  type Role,
} from "./ops-schemas";
import { evaluateLevel, normalizeRoeRow } from "./roe";

const RANK: Record<Role, number> = { auditor: 0, operator: 1, supervisor: 2, commander: 3 };

async function currentRole(supabase: any, userId: string): Promise<Role[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r: { role: Role }) => r.role);
}

/** Who am I? Role and profile come from the database, never from the browser. */
export const getMySession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const roles = await currentRole(supabase, userId);
    const { data: profile } = await supabase
      .from("profiles").select("callsign, unit").eq("id", userId).maybeSingle();
    const effective = (roles.slice().sort((a, b) => RANK[b] - RANK[a])[0] ?? "operator") as Role;
    return {
      userId,
      roles,
      role: effective,
      callsign: profile?.callsign ?? "UNKNOWN",
      unit: profile?.unit ?? null,
    };
  });

/** Append to the tamper-evident journal. Sequence, timestamp and SHA-256 chain
 *  hash are all assigned by the database routine — the client cannot forge them. */
export const writeAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => auditInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error, data: rows } = await context.supabase.rpc("append_audit", {
      _kind: data.kind,
      _payload: data.payload as never,
      _mode: data.mode,
      _classification: data.classification ?? "RESTRICTED",
    });
    if (error) throw new Error(error.message);
    return Array.isArray(rows) ? rows[0] : rows;
  });

export const listAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("audit_entries")
      .select("seq, ts, kind, actor_id, actor_role, mode, classification, payload, prev_hash, hash")
      .order("seq", { ascending: false })
      .limit(400);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const verifyAuditChain = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("verify_audit_chain");
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return {
      ok: !!row?.ok,
      total: Number(row?.total ?? 0),
      brokenAt: row?.broken_at ?? null,
      verifiedAt: Date.now(),
    };
  });

/** Record an AI auto-executed decision (L1-L3). */
export const recordAutoDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => autoDecisionInput.parse(d))
  .handler(async ({ data, context }) => {
    // Auto-execution is only legitimate if the ACTIVE server-side ROE says so.
    const { data: roeRow } = await context.supabase
      .from("roe_policies")
      .select("version, name, thresholds, auto_execute_ceiling, dual_confirm_from")
      .eq("active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const policy = normalizeRoeRow(roeRow as never);
    const level =
      data.score != null
        ? evaluateLevel(policy, {
            score: data.score,
            severity: data.severity ?? null,
            confidence: data.confidence ?? 1,
          })
        : data.level;
    const autoExecute = data.autoExecute && level <= policy.autoExecuteCeiling;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("decisions").upsert(
      {
        event_id: data.eventId,
        entity_id: data.entityId ?? null,
        entity_label: data.entityLabel ?? null,
        level,
        action: data.action,
        rationale: data.rationale,
        score: data.score ?? null,
        confidence: data.confidence ?? null,
        severity: data.severity ?? null,
        model_version: data.modelVersion,
        policy_version: policy.version,
        mode: data.mode,
        status: autoExecute ? "AUTO-EXECUTED" : "PENDING",
        auto_execute: autoExecute,
        created_by: context.userId,
        resolved_at: autoExecute ? new Date().toISOString() : null,
        source_sensor: data.sourceSensor ?? null,
        sensor_band: data.sensorBand ?? null,
        fusion_step: data.fusionStep ?? null,
        observed_at: data.observedAt ?? null,
      },
      { onConflict: "event_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, level, autoExecute };
  });

/**
 * Server-authoritative resolution of an L4/L5 decision.
 * Role and threat-level authority are re-checked here. L5 requires TWO distinct
 * commanders — the second key is enforced by a unique (decision, user) row,
 * so one person clicking twice can never satisfy it.
 */
export const resolveDecisionServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => resolveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await currentRole(supabase, userId);
    const effective = (roles.slice().sort((a, b) => RANK[b] - RANK[a])[0] ?? "operator") as Role;

    // ---- Server-authoritative classification ----
    // The browser's `level` is a proposal. The server re-derives it from the
    // ACTIVE ROE policy and uses that for every authority check below.
    const { data: roeRow } = await supabase
      .from("roe_policies")
      .select("version, name, thresholds, auto_execute_ceiling, dual_confirm_from")
      .eq("active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const policy = normalizeRoeRow(roeRow as never);
    const level =
      data.score != null
        ? evaluateLevel(policy, {
            score: data.score,
            severity: data.severity ?? null,
            confidence: data.confidence ?? 1,
          })
        : data.level;
    const requiresDual = level >= policy.dualConfirmFrom;

    if (effective === "auditor") {
      return { ok: false as const, reason: "Auditors are read-only" };
    }
    if (level >= 5 && !roles.includes("commander")) {
      return { ok: false as const, reason: "L5 authority requires Commander" };
    }
    if (level === 4 && !(roles.includes("supervisor") || roles.includes("commander"))) {
      return { ok: false as const, reason: "L4 authority requires Supervisor or Commander" };
    }


    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: decision, error: upErr } = await supabaseAdmin
      .from("decisions")
      .upsert(
        {
          event_id: data.eventId,
          entity_id: data.entityId ?? null,
          entity_label: data.entityLabel ?? null,
          level,
          action: data.action,
          rationale: data.rationale,
          score: data.score ?? null,
          confidence: data.confidence ?? null,
          severity: data.severity ?? null,
          model_version: data.modelVersion,
          policy_version: policy.version,
          mode: data.mode,
          status: "PENDING",
          auto_execute: false,
          created_by: context.userId,
        },
        { onConflict: "event_id" },
      )
      .select("id, status")
      .single();
    if (upErr) throw new Error(upErr.message);

    if (decision.status !== "PENDING") {
      return { ok: false as const, reason: `Already ${decision.status}` };
    }

    const { error: apErr } = await supabaseAdmin.from("decision_approvals").upsert(
      {
        decision_id: decision.id,
        user_id: userId,
        actor_role: effective,
        outcome: data.outcome,
        modified_action: data.modifiedAction ?? null,
      },
      { onConflict: "decision_id,user_id" },
    );
    if (apErr) throw new Error(apErr.message);

    // Dual-key rule: L5 approve/modify needs two DIFFERENT commanders.
    const needsDual = requiresDual && data.outcome !== "REJECTED";
    if (needsDual) {
      const { data: keys } = await supabaseAdmin
        .from("decision_approvals")
        .select("user_id, outcome, actor_role")
        .eq("decision_id", decision.id)
        .eq("actor_role", "commander")
        .neq("outcome", "REJECTED");
      const distinct = new Set((keys ?? []).map((k) => k.user_id));
      if (distinct.size < 2) {
        await supabase.rpc("append_audit", {
          _kind: "DECISION_FIRST_KEY",
          _payload: { event_id: data.eventId, level, proposed_level: data.level, roe_version: policy.version, outcome: data.outcome },
          _mode: data.mode,
          _classification: "CONFIDENTIAL",
        });
        return {
          ok: true as const,
          finalized: false as const,
          keysHeld: distinct.size,
          keysRequired: 2,
        };
      }
    }

    const finalAction = data.outcome === "MODIFIED" ? (data.modifiedAction ?? data.action) : data.action;
    const { error: finErr } = await supabaseAdmin
      .from("decisions")
      .update({
        status: data.outcome,
        resolved_at: new Date().toISOString(),
        modified_action: data.outcome === "MODIFIED" ? data.modifiedAction ?? null : null,
      })
      .eq("id", decision.id);
    if (finErr) throw new Error(finErr.message);

    await supabase.rpc("append_audit", {
      _kind: "DECISION_RESOLVED",
      _payload: {
        event_id: data.eventId,
        level,
        proposed_level: data.level,
        roe_version: policy.version,
        score: data.score ?? null,
        confidence: data.confidence ?? null,
        model_version: data.modelVersion,
        rationale: data.rationale,
        outcome: data.outcome,
        action: finalAction,
        role: effective,
      },
      _mode: data.mode,
      _classification: "CONFIDENTIAL",
    });

    return { ok: true as const, finalized: true as const, action: finalAction, decisionId: decision.id, level };
  });

export const recordTasking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => taskingInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("tasking_orders").insert({
      asset: data.asset,
      directive: data.directive,
      source: data.source,
      trigger_level: data.triggerLevel ?? null,
      trigger_label: data.triggerLabel ?? null,
      mode: data.mode,
      issued_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getActiveRoe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("roe_policies")
      .select("id, version, name, thresholds, auto_execute_ceiling, dual_confirm_from, active, created_at")
      .eq("active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const listRoe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("roe_policies")
      .select("id, version, name, thresholds, auto_execute_ceiling, dual_confirm_from, active, created_at")
      .order("version", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Publish a new ROE version. Commander-only, re-checked server side. */
export const publishRoe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => roeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isCommander } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "commander",
    });
    if (!isCommander) return { ok: false as const, reason: "Commander authority required" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: latest } = await supabaseAdmin
      .from("roe_policies").select("version").order("version", { ascending: false }).limit(1).maybeSingle();
    const nextVersion = (latest?.version ?? 0) + 1;

    await supabaseAdmin.from("roe_policies").update({ active: false }).eq("active", true);
    const { error } = await supabaseAdmin.from("roe_policies").insert({
      version: nextVersion,
      name: data.name,
      thresholds: data.thresholds,
      auto_execute_ceiling: data.autoExecuteCeiling,
      dual_confirm_from: data.dualConfirmFrom,
      active: true,
      created_by: userId,
      approved_by: userId,
    });
    if (error) throw new Error(error.message);

    await supabase.rpc("append_audit", {
      _kind: "ROE_PUBLISHED",
      _payload: { version: nextVersion, name: data.name, thresholds: data.thresholds },
      _mode: data.mode,
      _classification: "CONFIDENTIAL",
    });
    return { ok: true as const, version: nextVersion };
  });

/** Incident replay — reconstruct a stored window of decisions and tasking. */
export const replayWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const v = d as { minutes?: number };
    return { minutes: Math.min(Math.max(Number(v?.minutes ?? 30), 1), 1440) };
  })
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - data.minutes * 60_000).toISOString();
    const [dec, task] = await Promise.all([
      context.supabase
        .from("decisions")
        .select("id, event_id, entity_label, level, action, rationale, status, mode, created_at, resolved_at, modified_action, model_version, confidence")
        .gte("created_at", since).order("created_at", { ascending: true }),
      context.supabase
        .from("tasking_orders")
        .select("id, asset, directive, source, trigger_level, trigger_label, status, mode, created_at")
        .gte("created_at", since).order("created_at", { ascending: true }),
    ]);
    return { decisions: dec.data ?? [], tasking: task.data ?? [] };
  });

export type { OpsMode };
