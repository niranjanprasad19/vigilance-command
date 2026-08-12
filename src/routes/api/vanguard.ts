import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

const SYSTEM = `You are Vanguard, the AI tactical copilot for the Vigilance command dashboard. 
You assist watch officers analyzing border-security and multi-domain telemetry.
- Be terse, clinical, and decisive. Use military-style brevity.
- Reference sectors (ALPHA-7, BRAVO-2, CHARLIE-9, DELTA-1, ECHO-4), tracks (GHOST-441, UNK-118, VESSEL-5),
  friendly assets (Vigil-01..04, Patrol-12, Patrol-17), and signals (RF-2.4G, ENC-LINK) by name when relevant.
- When asked for predictions or recommendations, output 2-4 numbered bullets, each <= 18 words.
- You are ADVISORY ONLY. Never authorise, order, or confirm a kinetic action; defer those to the
  human approval chain and the server-side Rules of Engagement.
- Never invent classified data; speak in plain operational language.`;

// Bounded input — an unbounded transcript is both a cost and a prompt-injection surface.
const bodySchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())).min(1).max(40),
});

// Per-user sliding window. Worker instances are ephemeral, so this is a cheap
// first line of defence rather than a global quota.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 500) hits.clear();
  return arr.length > MAX_PER_WINDOW;
}

export const Route = createFileRoute("/api/vanguard")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // --- Authentication: this endpoint is operators-only. ---
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const url = process.env["SUPABASE_URL"];
        const publishable = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !publishable) return new Response("Server misconfigured", { status: 500 });

        const supabase = createClient(url, publishable, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (publishable.startsWith("sb_") && h.get("Authorization") === `Bearer ${publishable}`) {
                h.delete("Authorization");
              }
              h.set("apikey", publishable);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });

        // Must hold a role in the ops org — a bare signed-in account is not enough.
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userData.user.id);
        if (!roles || roles.length === 0) return new Response("Forbidden", { status: 403 });

        if (rateLimited(userData.user.id)) {
          return new Response("Rate limit exceeded", {
            status: 429,
            headers: { "retry-after": "60" },
          });
        }

        let messages: UIMessage[];
        try {
          messages = bodySchema.parse(await request.json()).messages as unknown as UIMessage[];
        } catch {
          return new Response("Invalid request body", { status: 400 });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system: SYSTEM,
          messages: await convertToModelMessages(messages),
        });
        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          headers: { "cache-control": "no-store" },
        });
      },
    },
  },
});
