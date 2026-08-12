import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Send } from "lucide-react";

export function VanguardConsole() {
  const [input, setInput] = useState("");
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/vanguard",
        // The endpoint is authenticated; attach the caller's session token.
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
  );
  const { messages, sendMessage, status, error } = useChat({ transport });

  useEffect(() => {
    if (messages.length === 0) {
      sendMessage({ text: "Brief me on the current battlespace posture in 3 bullets." }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Vanguard AI · Operational Copilot
        </div>
        <div className={`font-mono text-[10px] flex items-center gap-1.5 ${isLoading ? "text-warning" : "text-cyan"}`}>
          <span className={`w-1.5 h-1.5 rounded-full pulse-dot ${isLoading ? "bg-warning" : "bg-cyan"}`} />
          {isLoading ? "THINKING" : "READY"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "text-foreground" : "text-cyan"}>
            <div className="font-mono text-[10px] uppercase tracking-wider mb-1 opacity-60">
              {m.role === "user" ? "OPERATOR" : "VANGUARD"}
            </div>
            <div className="whitespace-pre-wrap leading-relaxed">
              {m.parts.map((p, i) => (p.type === "text" ? <span key={i}>{p.text}</span> : null))}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="text-cyan font-mono text-xs">▍</div>
        )}
        {error && <div className="text-destructive text-xs font-mono">ERROR: {error.message}</div>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || isLoading) return;
          sendMessage({ text: input.trim() });
          setInput("");
        }}
        className="border-t border-border p-2 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
          placeholder="Query Vanguard…"
          className="flex-1 bg-background border border-border px-3 py-2 font-mono text-xs outline-none focus:border-cyan"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-3 bg-cyan text-primary-foreground disabled:opacity-30 hover:bg-cyan/90 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
