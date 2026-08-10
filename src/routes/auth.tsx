import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Vigilance · Secure Access" },
      { name: "description", content: "Authenticate to the Vigilance command console. Role and clearance are issued by the operations server." },
      { property: "og:title", content: "Vigilance · Secure Access" },
      { property: "og:description", content: "Authenticate to the Vigilance command console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") ? s.redirect : "/dashboard",
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [callsign, setCallsign] = useState("");
  const [unit, setUnit] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirect, replace: true });
    });
  }, [navigate, redirect]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    try {
      if (tab === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: redirect, replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${redirect}`,
            data: { callsign: callsign || email.split("@")[0], unit },
          },
        });
        if (error) throw error;
        if (data.session) navigate({ to: redirect, replace: true });
        else setMsg("Account created. Check your email to confirm access before signing in.");
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setErr(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) { setErr("Google sign-in failed"); return; }
    if (result.redirected) return;
    navigate({ to: redirect, replace: true });
  };

  return (
    <div className="min-h-screen bg-background grid-bg-fine flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md border border-border bg-card/80 backdrop-blur relative">
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-cyan">
            <ShieldCheck className="w-3.5 h-3.5" /> Vigilance · Restricted
          </div>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight">Secure access</h1>
          <p className="mt-1 text-xs text-muted-foreground font-mono">
            Clearance and role are issued by the operations server. They cannot be selected here.
          </p>
        </div>

        <div className="flex border-b border-border">
          {(["signin", "signup"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setErr(null); setMsg(null); }}
              className={`flex-1 py-2 font-mono text-[10px] uppercase tracking-[0.18em] border-b-2 transition ${
                tab === t ? "text-cyan border-cyan" : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              {t === "signin" ? "Sign in" : "Request account"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="p-6 space-y-3">
          {tab === "signup" && (
            <>
              <Field label="Callsign" value={callsign} onChange={setCallsign} placeholder="HAWKEYE-1" maxLength={40} />
              <Field label="Unit" value={unit} onChange={setUnit} placeholder="BORDER SEC · SECTOR ALPHA" maxLength={60} />
            </>
          )}
          <Field label="Email" value={email} onChange={setEmail} type="email" required placeholder="operator@agency.gov" maxLength={255} />
          <Field label="Password" value={password} onChange={setPassword} type="password" required placeholder="••••••••" maxLength={72} />

          {err && <div className="border border-destructive/60 text-destructive font-mono text-[10px] px-2 py-1.5">{err}</div>}
          {msg && <div className="border border-cyan/50 text-cyan font-mono text-[10px] px-2 py-1.5">{msg}</div>}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-cyan text-cyan hover:bg-cyan hover:text-primary-foreground transition font-mono text-[11px] uppercase tracking-[0.2em] disabled:opacity-50"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {tab === "signin" ? "Authenticate" : "Request access"}
          </button>

          <div className="flex items-center gap-2 py-1">
            <div className="h-px flex-1 bg-border" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={google}
            className="w-full py-2.5 border border-border text-foreground hover:border-cyan hover:text-cyan transition font-mono text-[11px] uppercase tracking-[0.2em]"
          >
            Continue with Google
          </button>
        </form>

        <div className="px-6 pb-5 font-mono text-[9px] text-muted-foreground leading-relaxed">
          The first account created on a new deployment is provisioned as Commander. All
          subsequent accounts are provisioned as Operator until a Commander elevates them.
          <div className="mt-2">
            <Link to="/" className="text-cyan hover:underline">← Return to overview</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", required, placeholder, maxLength,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string; maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-background border border-border px-3 py-2 font-mono text-xs outline-none focus:border-cyan"
      />
    </label>
  );
}
