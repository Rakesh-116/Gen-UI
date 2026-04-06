// openai.js - OpenAI provider adapter.
import { SYSTEM_PROMPT_BASE } from "../systemPrompt.js";
import { streamSse } from "../streaming.js";

export function createOpenAIProvider(apiKeyOverride) {
  const apiKey = apiKeyOverride || import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VITE_OPENAI_API_KEY.");
  }

  return {
    name: "openai",
    async stream({ messages, onText, onComplete, onError, systemPrompt }) {
      try {
        const payload = {
          model: import.meta.env.VITE_OPENAI_MODEL || "gpt-4o-mini",
          stream: true,
          messages: [
            { role: "system", content: systemPrompt || SYSTEM_PROMPT_BASE },
            ...messages
          ]
        };

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify(payload)
        });

        await streamSse(response, (json) => {
          const delta = json?.choices?.[0]?.delta?.content;
          if (delta) onText(delta);
        });

        onComplete();
      } catch (error) {
        onError(error);
      }
    }
  };
}

