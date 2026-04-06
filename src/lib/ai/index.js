// index.js - AI provider selection and message serialization helpers.
import { createAnthropicProvider } from "./providers/anthropic.js";
import { createOpenAIProvider } from "./providers/openai.js";
import { createGroqProvider } from "./providers/groq.js";
import { createGeminiProvider } from "./providers/gemini.js";
import { createOllamaProvider } from "./providers/ollama.js";
import { buildSystemPrompt } from "./systemPrompt.js";

export function serializeMessages(messages, options = {}) {
  const { includeWidgets = false, maxMessages } = options;
  const source = Array.isArray(messages) ? messages : [];
  const sliced =
    typeof maxMessages === "number" ? source.slice(-maxMessages) : source;

  return sliced.map((message) => {
    let content = message.textContent || message.content || "";
    if (includeWidgets && message.widgetHTML) {
      content += `\n<artifact type="html">\n${message.widgetHTML}\n</artifact>`;
    }
    return {
      role: message.role,
      content
    };
  });
}

export function getAIProvider({ provider, apiKey } = {}) {
  const selected = (provider || import.meta.env.VITE_AI_PROVIDER || "anthropic").toLowerCase();

  switch (selected) {
    case "openai":
      return createOpenAIProvider(apiKey);
    case "groq":
      return createGroqProvider(apiKey);
    case "gemini":
      return createGeminiProvider(apiKey);
    case "ollama":
      return createOllamaProvider();
    case "anthropic":
    default:
      return createAnthropicProvider(apiKey);
  }
}

export async function streamAIResponse({
  messages,
  onText,
  onError,
  onComplete,
  systemPrompt,
  provider,
  apiKey
}) {
  const providerInstance = getAIProvider({ provider, apiKey });
  const normalized = messages.map((message) => ({
    role: message.role,
    content: message.content ?? message.textContent ?? ""
  }));

  await providerInstance.stream({
    messages: normalized,
    onText,
    onError,
    onComplete,
    systemPrompt: systemPrompt || buildSystemPrompt()
  });
}
