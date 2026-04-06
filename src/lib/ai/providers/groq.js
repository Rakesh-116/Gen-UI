// groq.js - Groq provider adapter.
import { SYSTEM_PROMPT_BASE } from "../systemPrompt.js";
import { streamSse } from "../streaming.js";

export function createGroqProvider(apiKeyOverride) {
  return {
    name: "groq",
    async stream({ messages, onText, onComplete, onError, systemPrompt }) {
      try {
        const apiKey = apiKeyOverride || import.meta.env.VITE_GROQ_API_KEY;
        const useDirect = Boolean(apiKeyOverride);
        const payload = {
          model: import.meta.env.VITE_GROQ_MODEL || "llama-3.1-8b-instant",
          stream: true,
          messages: [
            { role: "system", content: systemPrompt || SYSTEM_PROMPT_BASE },
            ...messages
          ]
        };

        const response = await fetch(
          useDirect
            ? "https://api.groq.com/openai/v1/chat/completions"
            : "/api/groq",
          {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
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

