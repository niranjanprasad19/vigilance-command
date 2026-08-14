// Step-up MFA for high-authority (L5 / dual-confirm) actions.
// The TOTP factor is enrolled and verified through Supabase Auth MFA; once a
// user has a verified factor they can mint a short-lived server-signed step-up
// token, which resolveDecisionServer re-validates with the signing key.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STEPUP_TTL_MS = 5 * 60_000;

export const getMfaStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.auth.mfa.listFactors();
    if (error) return { enrolled: false, factorId: null, reason: error.message };
    const totp = (data?.totp ?? []).find((f) => (f as { factor_type?: string }).factor_type === "totp");
    return { enrolled: !!(totp as { verified?: boolean } | undefined)?.verified, factorId: totp?.id ?? null, reason: null };
  });

export const enrollMfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error) return { ok: false as const, reason: error.message };
    return {
      ok: true as const,
      factorId: data.id,
      qr: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    };
  });

export const verifyMfaEnroll = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const v = d as { factorId?: string; code?: string };
    return { factorId: String(v.factorId ?? ""), code: String(v.code ?? "") };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.auth.mfa.verify({
      factorId: data.factorId,
      challengeId: "", // verify-at-enroll uses the verify helper below
      code: data.code,
    });
    // Supabase requires a challenge for verify; for enrollment confirmation use challenge+verify.
    const ch = await context.supabase.auth.mfa.challenge({ factorId: data.factorId });
    const v = await context.supabase.auth.mfa.verify({
      factorId: data.factorId,
      challengeId: ch.data?.id ?? "",
      code: data.code,
    });
    if (error && v.error) return { ok: false as const, reason: (v.error ?? error).message };
    return { ok: true as const };
  });

export const stepUpChallenge = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const v = d as { factorId?: string };
    return { factorId: String(v.factorId ?? "") };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: ch, error } = await context.supabase.auth.mfa.challenge({ factorId: data.factorId });
    if (error) return { ok: false as const, reason: error.message };
    return { ok: true as const, challengeId: ch!.id, expiresAt: ch!.expires_at * 1000 };
  });

export const stepUpVerify = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const v = d as { factorId?: string; challengeId?: string; code?: string };
    return {
      factorId: String(v.factorId ?? ""),
      challengeId: String(v.challengeId ?? ""),
      code: String(v.code ?? ""),
    };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.auth.mfa.verify({
      factorId: data.factorId,
      challengeId: data.challengeId,
      code: data.code,
    });
    if (error) return { ok: false as const, reason: error.message };
    const { mintStepUpToken } = await import("./crypto.server");
    const secret = process.env["AUDIT_STEPUP_KEY"]!;
    const { token, expiresAt } = await mintStepUpToken(secret, context.userId, STEPUP_TTL_MS);
    return { ok: true as const, stepUpToken: token, expiresAt };
  });
