// gemini.js - Gemini provider adapter.
import { SYSTEM_PROMPT_BASE } from "../systemPrompt.js";
import { streamSse } from "../streaming.js";

const DEFAULT_MODEL = "gemini-2.0-flash";

export function createGeminiProvider(apiKeyOverride) {
  const apiKey = apiKeyOverride || import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VITE_GEMINI_API_KEY.");
  }

  return {
    name: "gemini",
    async stream({ messages, onText, onComplete, onError, systemPrompt }) {
      try {
        const model = import.meta.env.VITE_GEMINI_MODEL || DEFAULT_MODEL;
        const contents = messages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }]
        }));

        const payload = {
          contents,
          systemInstruction: {
            role: "system",
            parts: [{ text: systemPrompt || SYSTEM_PROMPT_BASE }]
          }
        };

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          }
        );

        await streamSse(response, (json) => {
          const parts = json?.candidates?.[0]?.content?.parts;
          if (!parts) return;
          for (const part of parts) {
            if (part?.text) onText(part.text);
          }
        });

        onComplete();
      } catch (error) {
        onError(error);
      }
    }
  };
}

