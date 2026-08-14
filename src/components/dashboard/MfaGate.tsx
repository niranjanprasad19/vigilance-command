// Step-up MFA for L5 / dual-confirm authority.
//
// Two flows live here:
//   <MfaEnroll/>  — one-time TOTP enrollment (enroll → scan QR → verify code).
//   <MfaStepUp/>  — per-action challenge that mints a short-lived server-signed
//                   step-up token, which resolveDecisionServer re-validates.
//
// The token never grants authority on its own — it only proves the actor
// re-authenticated recently. Role + dual-key checks still run server-side.

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, ShieldCheck, X, Smartphone, Loader2 } from "lucide-react";
import {
  enrollMfa,
  verifyMfaEnroll,
  stepUpChallenge,
  stepUpVerify,
} from "@/lib/auth.stepup.functions";

/** One-time TOTP enrollment wizard. */
export function MfaEnroll({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const enroll = useServerFn(enrollMfa);
  const verify = useServerFn(verifyMfaEnroll);
  const [phase, setPhase] = useState<"loading" | "qr" | "verify" | "done" | "error">("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await enroll({});
      if (cancelled) return;
      if (res.ok) {
        setFactorId(res.factorId);
        setQr(res.qr);
        setUri(res.uri);
        setPhase("qr");
      } else {
        setErr(res.reason);
        setPhase("error");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!factorId || !code) return;
    setBusy(true); setErr(null);
    const res = await verify({ data: { factorId, code } });
    setBusy(false);
    if (res.ok) { setPhase("done"); setTimeout(onDone, 600); }
    else setErr(res.reason ?? "Verification failed");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-[min(92vw,420px)] border border-border bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <Smartphone className="w-3 h-3 text-cyan" /> MFA Enrollment · TOTP
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
        </div>

        <div className="p-4 space-y-3">
          {phase === "loading" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <Loader2 className="w-3 h-3 animate-spin" /> Generating factor…
            </div>
          )}
          {phase === "qr" && qr && (
            <>
              <div className="text-xs text-muted-foreground font-mono leading-snug">
                Scan with an authenticator app (1Password, Authy, Google Authenticator), then enter the 6-digit code.
              </div>
              <div className="flex justify-center bg-white p-2">
                <img src={qr} alt="TOTP QR code" className="w-44 h-44" />
              </div>
              <details className="text-[9px] text-muted-foreground font-mono">
                <summary className="cursor-pointer">manual secret / uri</summary>
                <div className="break-all px-1 py-1">{uri}</div>
              </details>
              <input
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                className="w-full bg-background border border-cyan px-3 py-2 font-mono text-lg tracking-[0.4em] text-center outline-none"
              />
              <button
                onClick={submit}
                disabled={code.length !== 6 || busy}
                className="w-full py-2 border border-cyan text-cyan hover:bg-cyan hover:text-primary-foreground font-mono text-[11px] uppercase tracking-wider disabled:opacity-30"
              >
                {busy ? "Verifying…" : "Verify & enroll"}
              </button>
            </>
          )}
          {phase === "done" && (
            <div className="flex items-center gap-2 text-cyan font-mono text-xs py-4 justify-center">
              <ShieldCheck className="w-4 h-4" /> Factor verified · step-up enabled
            </div>
          )}
          {phase === "error" && (
            <div className="text-destructive font-mono text-xs">{err ?? "Enrollment failed"}</div>
          )}
          {err && phase !== "error" && (
            <div className="text-destructive font-mono text-[10px]">{err}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Per-action step-up challenge. Calls onToken with the signed token. */
export function MfaStepUp({
  factorId,
  onClose,
  onToken,
}: {
  factorId: string;
  onClose: () => void;
  onToken: (token: string, expiresAt: number) => void;
}) {
  const challenge = useServerFn(stepUpChallenge);
  const verify = useServerFn(stepUpVerify);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true); setErr(null);
      const res = await challenge({ data: { factorId } });
      if (cancelled) return;
      setBusy(false);
      if (res.ok) setChallengeId(res.challengeId);
      else setErr(res.reason ?? "Challenge failed");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factorId]);

  const submit = async () => {
    if (!challengeId || code.length !== 6) return;
    setBusy(true); setErr(null);
    const res = await verify({ data: { factorId, challengeId, code } });
    setBusy(false);
    if (res.ok) onToken(res.stepUpToken, res.expiresAt);
    else setErr(res.reason ?? "Verification failed");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-[min(92vw,360px)] border border-destructive/60 bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-destructive">
            <KeyRound className="w-3 h-3" /> Step-up required · L5 authority
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-xs text-muted-foreground font-mono leading-snug">
            Finalising a dual-confirm command needs re-authentication. Enter the current TOTP code from your authenticator.
          </div>
          {busy && !challengeId && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <Loader2 className="w-3 h-3 animate-spin" /> Issuing challenge…
            </div>
          )}
          {challengeId && (
            <>
              <input
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="000000"
                inputMode="numeric"
                className="w-full bg-background border border-cyan px-3 py-2 font-mono text-lg tracking-[0.4em] text-center outline-none"
              />
              <button
                onClick={submit}
                disabled={code.length !== 6 || busy}
                className="w-full py-2 border border-cyan text-cyan hover:bg-cyan hover:text-primary-foreground font-mono text-[11px] uppercase tracking-wider disabled:opacity-30"
              >
                {busy ? "Verifying…" : "Authenticate & finalise"}
              </button>
            </>
          )}
          {err && <div className="text-destructive font-mono text-[10px]">{err}</div>}
        </div>
      </div>
    </div>
  );
}
