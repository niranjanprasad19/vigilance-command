import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

const SYSTEM = `You are Vanguard, the AI tactical copilot for the Vigilance command dashboard. 
You assist watch officers analyzing border-security and multi-domain telemetry.
- Be terse, clinical, and decisive. Use military-style brevity.
- Reference sectors (ALPHA-7, BRAVO-2, CHARLIE-9, DELTA-1, ECHO-4), tracks (GHOST-441, UNK-118, VESSEL-5),
  friendly assets (Vigil-01..04, Patrol-12, Patrol-17), and signals (RF-2.4G, ENC-LINK) by name when relevant.
- When asked for predictions or recommendations, output 2-4 numbered bullets, each <= 18 words.
- Never invent classified data; speak in plain operational language.`;

export const Route = createFileRoute("/api/vanguard")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { messages } = (await request.json()) as { messages?: UIMessage[] };
        if (!Array.isArray(messages)) return new Response("messages required", { status: 400 });

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system: SYSTEM,
          messages: await convertToModelMessages(messages),
        });
        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
