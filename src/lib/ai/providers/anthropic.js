// anthropic.js - Anthropic provider adapter.
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, SYSTEM_PROMPT_BASE } from "../systemPrompt.js";

export function createAnthropicProvider(apiKeyOverride) {
  const apiKey = apiKeyOverride || import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VITE_ANTHROPIC_API_KEY.");
  }

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true
  });

  return {
    name: "anthropic",
    async stream({ messages, onText, onComplete, onError, systemPrompt }) {
      const stream = client.messages.stream({
        model: import.meta.env.VITE_ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt || SYSTEM_PROMPT_BASE,
        messages
      });

      stream.on("text", (textDelta) => {
        if (textDelta) onText(textDelta);
      });

      stream.on("error", (error) => onError(error));
      stream.on("abort", (error) => onError(error));
      stream.on("end", () => onComplete());
    }
  };
}

