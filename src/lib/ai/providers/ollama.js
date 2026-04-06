// ollama.js - Ollama provider adapter.
import { SYSTEM_PROMPT_BASE } from "../systemPrompt.js";
import { streamNdjson } from "../streaming.js";

export function createOllamaProvider() {
  const baseUrl = import.meta.env.VITE_OLLAMA_BASE_URL || "http://localhost:11434";
  const model = import.meta.env.VITE_OLLAMA_MODEL || "llama3.1";

  return {
    name: "ollama",
    async stream({ messages, onText, onComplete, onError, systemPrompt }) {
      try {
        const payload = {
          model,
          stream: true,
          messages: [
            { role: "system", content: systemPrompt || SYSTEM_PROMPT_BASE },
            ...messages
          ]
        };

        const response = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        await streamNdjson(response, (json) => {
          const delta = json?.message?.content || json?.response;
          if (delta) onText(delta);
        });

        onComplete();
      } catch (error) {
        onError(error);
      }
    }
  };
}

