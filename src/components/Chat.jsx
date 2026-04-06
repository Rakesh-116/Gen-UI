// Chat.jsx - Main chat container handling input, streaming, and widget rendering.
import { useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import InputBar from "./InputBar.jsx";
import MessageList from "./MessageList.jsx";
import { createStreamParser } from "../lib/streamParser.js";
import { serializeMessages, streamAIResponse } from "../lib/ai/index.js";
import { needsSearch, extractSearchQuery } from "../lib/intentDetector.js";
import { formatSearchContext, searchWeb } from "../lib/search.js";
import { buildSystemPrompt } from "../lib/ai/systemPrompt.js";

const WIDGET_SPLIT = "\n<!-- WIDGET_SPLIT -->\n";
const MAX_CONTEXT_MESSAGES = 6;
const MAX_MESSAGE_CHARS = 1200;

const formatAIError = (error) => {
  const raw = error?.message || "";
  const lower = raw.toLowerCase();

  if (
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("tokens per minute") ||
    lower.includes("tpm")
  ) {
    return "Rate limit reached for the current model. Please wait a moment and try again.";
  }

  if (
    lower.includes("payload too large") ||
    lower.includes("request too large") ||
    lower.includes("413")
  ) {
    return "Request is too large for the model. Try a shorter prompt or clear the chat history.";
  }

  if (lower.includes("401") || lower.includes("unauthorized")) {
    return "Authentication failed. Please check the selected provider API key.";
  }

  return "Something went wrong while generating the response. Please try again.";
};

const extractWidgetFromText = (text) => {
  if (!text) return { text };
  let working = text;

  const artifactMatch = working.match(
    /<artifact[^>]*type\s*=\s*["']html["'][^>]*>([\s\S]*?)<\/artifact>/i
  );
  if (artifactMatch) {
    const widgetHTML = artifactMatch[1].trim();
    working = working.replace(artifactMatch[0], "").trim();
    return { text: working, widgetHTML };
  }

  const fencedMatch = working.match(/```html([\s\S]*?)```/i);
  if (fencedMatch && /<html|<!doctype html/i.test(fencedMatch[1])) {
    const widgetHTML = fencedMatch[1].trim();
    working = working.replace(fencedMatch[0], "").trim();
    return { text: working, widgetHTML };
  }

  const doctypeIdx = working.toLowerCase().indexOf("<!doctype html");
  if (doctypeIdx !== -1) {
    const htmlEndIdx = working.toLowerCase().indexOf("</html>");
    if (htmlEndIdx !== -1) {
      const widgetHTML = working
        .slice(doctypeIdx, htmlEndIdx + "</html>".length)
        .trim();
      working = (working.slice(0, doctypeIdx) + working.slice(htmlEndIdx + 7))
        .trim();
      return { text: working, widgetHTML };
    }
  }

  return { text: working };
};


export default function Chat({ settings }) {
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const widgetStateRef = useRef({ hasAny: false, newWidget: true });
  const widgetBufferRef = useRef("");
  const tavilyKey = settings?.tavilyKey?.trim();
  const provider = settings?.provider;
  const providerKey = settings?.providerKey?.trim();
  const showStarters = messages.length === 0 && !isSending;
  const starterPrompts = [
    "Create a mini sales dashboard with KPI cards and a 12-month revenue line chart.",
    "Show a pie chart of expenses by category for a typical startup budget.",
    "Build a dashboard with a bar chart comparing product A vs B quarterly sales.",
    "Create a line chart of USD to INR from 2010-2025 with key dips annotated.",
    "Make a simple analytics view with DAU, MAU, and retention sparkline."
  ];

  const appendText = (assistantId, chunk) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === assistantId
          ? {
              ...message,
              textContent: (message.textContent || "") + chunk
            }
          : message
      )
    );
  };

  const appendWidgetChunk = (_assistantId, chunk) => {
    widgetBufferRef.current += chunk;
  };

  const finalizeWidget = (assistantId) => {
    const completeWidget = widgetBufferRef.current.trim();
    widgetBufferRef.current = "";
    widgetStateRef.current.newWidget = true;
    if (!completeWidget) return;

    setMessages((prev) =>
      prev.map((message) => {
        if (message.id !== assistantId) return message;
        let nextHtml = message.widgetHTML || "";
        if (widgetStateRef.current.hasAny && nextHtml) {
          nextHtml += WIDGET_SPLIT;
        }
        nextHtml += completeWidget;
        widgetStateRef.current.hasAny = true;
        return { ...message, widgetHTML: nextHtml };
      })
    );
  };

  const updateStatus = (assistantId, status) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === assistantId ? { ...message, status } : message
      )
    );
  };

  const handleSend = async (text) => {
    if (!text.trim() || isSending) return;

    const userMessage = {
      id: uuidv4(),
      role: "user",
      textContent: text,
      widgetHTML: null,
      status: "done"
    };

    const assistantId = uuidv4();
    const assistantMessage = {
      id: assistantId,
      role: "assistant",
      textContent: "",
      widgetHTML: null,
      status: "streaming",
      isSearching: false
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsSending(true);
    widgetStateRef.current = { hasAny: false, newWidget: true };
    widgetBufferRef.current = "";

    const parser = createStreamParser(
      (chunk) => appendText(assistantId, chunk),
      (chunk) => appendWidgetChunk(assistantId, chunk),
      () => finalizeWidget(assistantId)
    );

    try {
      let searchContext = "";

      if (needsSearch(text)) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, isSearching: true }
              : message
          )
        );

        try {
          const query = extractSearchQuery(text);
          const searchData = await searchWeb(query, tavilyKey || undefined);
          searchContext = formatSearchContext(searchData);
        } catch (error) {
          appendText(
            assistantId,
            `\n\n[Search Warning] ${error?.message || "Search failed. Continuing without it."}`
          );
        } finally {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, isSearching: false }
                : message
            )
          );
        }
      }

      const updatedMessages = serializeMessages([...messages, userMessage], {
        includeWidgets: false,
        maxMessages: MAX_CONTEXT_MESSAGES
      }).map((message) => ({
        ...message,
        content:
          message.content && message.content.length > MAX_MESSAGE_CHARS
            ? message.content.slice(-MAX_MESSAGE_CHARS)
            : message.content
      }));

      await streamAIResponse({
        messages: updatedMessages,
        systemPrompt: buildSystemPrompt(searchContext),
        provider,
        apiKey: providerKey,
        onText: (chunk) => parser.processChunk(chunk),
        onError: (error) => {
          updateStatus(assistantId, "error");
          appendText(
            assistantId,
            `\n\n[Error] ${formatAIError(error)}`
          );
          setIsSending(false);
        },
        onComplete: () => {
          parser.flush();
          if (widgetBufferRef.current) {
            finalizeWidget(assistantId);
          }
          if (!widgetStateRef.current.hasAny) {
            setMessages((prev) =>
              prev.map((message) => {
                if (message.id !== assistantId) return message;
                const { text, widgetHTML } = extractWidgetFromText(
                  message.textContent || ""
                );
                if (widgetHTML) {
                  widgetStateRef.current.hasAny = true;
                  return { ...message, textContent: text, widgetHTML };
                }
                return message;
              })
            );
          }
          updateStatus(assistantId, "done");
          setIsSending(false);
        }
      });
    } catch (error) {
      updateStatus(assistantId, "error");
      appendText(
        assistantId,
        `\n\n[Error] ${formatAIError(error)}`
      );
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col px-10 pb-10 pt-8">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
          Generative UI Chat
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-slate-900">
          Inline Widgets
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Ask for charts, dashboards, or interactive widgets and watch them render
          inside the conversation.
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        {showStarters ? (
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
              Try a prompt
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <MessageList messages={messages} />
      </div>
      <InputBar onSend={handleSend} disabled={isSending} />
    </div>
  );
}

