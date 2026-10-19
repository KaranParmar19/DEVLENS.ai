import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";


export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { messages?: UIMessage[]; mentions?: string[] };
        try {
          body = (await request.json()) as { messages?: UIMessage[]; mentions?: string[] };
        } catch {
          return new Response(JSON.stringify({ error: "Invalid request body." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const messages = body.messages ?? [];
        if (messages.length === 0) {
          return new Response(JSON.stringify({ error: "No messages provided." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const grokKey = process.env["GROK_API_KEY"] || process.env["XAI_API_KEY"];
        const lovableKey = process.env["LOVABLE_API_KEY"];
        const openaiKey = process.env["OPENAI_API_KEY"];
        const apiKey = grokKey || lovableKey || openaiKey || "";

        const baseURL =
          process.env["GROK_API_BASE_URL"] ||
          (grokKey
            ? "https://api.x.ai/v1"
            : lovableKey
            ? "https://ai.gateway.lovable.dev/v1"
            : "https://api.x.ai/v1");

        const modelName =
          process.env["GROK_MODEL"] ||
          (grokKey
            ? "grok-beta"
            : lovableKey
            ? "google/gemini-2.5-flash"
            : "grok-beta");

        const gateway = createOpenAI({
          baseURL,
          apiKey: apiKey || "grok-free-key",
          headers: lovableKey
            ? {
                "Lovable-API-Key": lovableKey,
                "X-Lovable-AIG-SDK": "vercel-ai-sdk",
              }
            : {},
        });

        const system = [
          "You are DevLens, a senior staff engineer reading an indexed repository.",
          "Answer strictly from the supplied dependency graph. If something is not in the graph, say so.",
          "Be concise and concrete: name real files, note fan-in/fan-out and blast radius.",
          "Cite files with the exact path wrapped in double square brackets, e.g. [[src/parser/ast.ts]].",
          "Never invent file paths that are absent from the index.",
          "",
          body.mentions && body.mentions.length > 0
            ? `Target files focused by user: ${body.mentions.join(", ")}`
            : "",
        ].filter(Boolean).join("\n");

        try {
          const result = streamText({
            model: gateway.chat(modelName),
            system,
            messages: await convertToModelMessages(messages),
            abortSignal: request.signal,
          });

          return result.toUIMessageStreamResponse({ originalMessages: messages });
        } catch (error) {
          console.error("copilot stream error:", error);
          return new Response(
            JSON.stringify({
              error: "The copilot query failed. Verify GROK_API_KEY or network connection.",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      },
    },
  },
});
