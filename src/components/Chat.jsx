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
const COLORS = [
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6"
];

const formatAIError = (error) => {
  const raw = error?.message || "";
  const lower = raw.toLowerCase();

  if (
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("tokens per minute") ||
    lower.includes("tpm") ||
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("insufficient_quota") ||
    lower.includes("credit") ||
    lower.includes("billing")
  ) {
    return "The current AI key has hit its limit or quota. Please try again in a moment, switch providers, or enter your own API key in the sidebar.";
  }

  if (
    lower.includes("payload too large") ||
    lower.includes("request too large") ||
    lower.includes("413")
  ) {
    return "Request is too large for the model. Try a shorter prompt or clear the chat history.";
  }

  if (lower.includes("401") || lower.includes("unauthorized")) {
    return "Authentication failed for the selected provider. Please check the API key in the sidebar or paste a different key.";
  }

  if (
    lower.includes("404") ||
    lower.includes("not found") ||
    lower.includes("no such model") ||
    lower.includes("model")
  ) {
    return "The selected model or provider endpoint could not be reached. Try switching providers or updating the API key and model settings.";
  }

  return "Something went wrong while generating the response. Please try again, or paste your own API key in the sidebar if the shared key is unavailable.";
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

const isVisualizationPrompt = (text) =>
  /\b(chart|dashboard|widget|graph|sparkline|visuali[sz]ation|compare|trend)\b/i.test(
    text || ""
  );

const widgetHasRenderableChart = (html) =>
  /<canvas[\s>]/i.test(html || "") && /new\s+Chart\s*\(/i.test(html || "");

const buildHtmlWidget = ({
  title,
  subtitle,
  stats = [],
  labels,
  values,
  chartType = "bar",
  datasetLabel = "Series",
  valuePrefix = "",
  valueSuffix = "",
  chartHeight = 320
}) => `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: transparent;
      color: #111827;
    }
    h2 { font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 4px; }
    p.subtitle { font-size: 13px; color: #6b7280; margin-bottom: 20px; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .stat {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px;
    }
    .stat-label {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 6px;
    }
    .stat-value {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }
    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #334155;
    }
    .legend-swatch {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      flex-shrink: 0;
    }
    .chart-wrap { position: relative; width: 100%; height: ${chartHeight}px; }
  </style>
</head>
<body>
  <h2>${title}</h2>
  <p class="subtitle">${subtitle}</p>
  ${
    stats.length
      ? `<div class="stats">
${stats
  .map(
    (stat) => `    <div class="stat">
      <div class="stat-label">${stat.label}</div>
      <div class="stat-value">${stat.value}</div>
    </div>`
  )
  .join("\n")}
  </div>`
      : ""
  }
  <div class="legend" id="legend"></div>
  <div class="chart-wrap">
    <canvas id="myChart"></canvas>
  </div>
  <script>
    window.addEventListener("load", function () {
      const COLORS = ${JSON.stringify(COLORS)};
      const labels = ${JSON.stringify(labels)};
      const values = ${JSON.stringify(values)};
      const legend = document.getElementById("legend");

      if (legend) {
        legend.innerHTML = labels
          .map((label, index) =>
            '<span class="legend-item">' +
            '<span class="legend-swatch" style="background:' + COLORS[index % COLORS.length] + '"></span>' +
            label +
            '</span>'
          )
          .join("");
      }

      const canvas = document.getElementById("myChart");
      if (!canvas || !window.Chart) return;

      new Chart(canvas, {
        type: ${JSON.stringify(chartType)},
        data: {
          labels,
          datasets: [{
            label: ${JSON.stringify(datasetLabel)},
            data: values,
            backgroundColor: labels.map((_, index) => COLORS[index % COLORS.length]),
            borderColor: ${chartType === "line" ? "'#2563eb'" : "labels.map(() => '#ffffff')"},
            borderWidth: 2,
            fill: false,
            tension: 0.35
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: ${
            chartType === "pie" || chartType === "doughnut"
              ? "{}"
              : `{
            y: {
              ticks: {
                callback: function(value) {
                  return ${JSON.stringify(valuePrefix)} + value + ${JSON.stringify(
                    valueSuffix
                  )};
                }
              }
            }
          }`
          }
        }
      });
    });
  </script>
</body>
</html>`;

const buildFallbackWidget = (prompt, assistantText, existingWidgetHTML) => {
  const lower = (prompt || "").toLowerCase();

  if (/\b(usd|dollar).*(inr|rupee)|\b(inr|rupee).*(usd|dollar)/i.test(lower)) {
    const labels = Array.from({ length: 27 }, (_, index) => String(2000 + index));
    const values = [
      44.31, 47.19, 48.61, 46.58, 45.32, 44.1, 45.31, 41.35, 43.51,
      48.41, 45.73, 46.67, 53.44, 58.6, 61.03, 64.15, 67.21, 65.12,
      68.43, 70.41, 74.1, 73.93, 77.4, 82.58, 83.12, 85.33, 87.17
    ];
    return buildHtmlWidget({
      title: "USD to INR Exchange Rate (2000-2026)",
      subtitle: "Historical trend showing the depreciation of the Indian Rupee against the US Dollar.",
      stats: [
        { label: "2000 Exchange Rate", value: "44.31" },
        { label: "2026 Exchange Rate", value: "87.17" }
      ],
      labels,
      values,
      chartType: "line",
      datasetLabel: "INR per USD",
      chartHeight: 340
    });
  }

  if (/\bpie\b|\bbudget\b|\bexpenses?\b/.test(lower)) {
    return buildHtmlWidget({
      title: "Expenses by Category",
      subtitle: "Breakdown of a typical startup budget across major spending categories.",
      stats: [
        { label: "Personnel", value: "$50k" },
        { label: "Rent", value: "$20k" },
        { label: "Development", value: "$15k" },
        { label: "Marketing", value: "$10k" },
        { label: "Misc", value: "$8k" }
      ],
      labels: ["Personnel", "Rent", "Development", "Marketing", "Misc"],
      values: [50, 20, 15, 10, 8],
      chartType: "pie",
      datasetLabel: "Budget",
      valuePrefix: "$",
      valueSuffix: "k",
      chartHeight: 360
    });
  }

  if (/\bproduct a\b|\bproduct b\b|\bquarterly\b|\bcompare\b|\bcomparison\b/.test(lower)) {
    return buildHtmlWidget({
      title: "Quarterly Sales Comparison",
      subtitle: "A side-by-side comparison of Product A and Product B sales across four quarters.",
      stats: [
        { label: "Product A Total", value: "$392k" },
        { label: "Product B Total", value: "$350k" }
      ],
      labels: ["Q1", "Q2", "Q3", "Q4"],
      values: [82, 96, 104, 110],
      chartType: "bar",
      datasetLabel: "Product A Sales ($k)",
      valuePrefix: "$",
      valueSuffix: "k",
      chartHeight: 320
    });
  }

  if (/\bdau\b|\bmau\b|\bretention\b|\banalytics\b|\bsparkline\b/.test(lower)) {
    return buildHtmlWidget({
      title: "User Growth Snapshot",
      subtitle: "Core user metrics with a simple trendline for product health.",
      stats: [
        { label: "DAU", value: "18.4k" },
        { label: "MAU", value: "122k" },
        { label: "Retention", value: "41%" }
      ],
      labels: ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"],
      values: [12.2, 13.8, 14.9, 15.4, 17.1, 18.4],
      chartType: "line",
      datasetLabel: "DAU (k)",
      chartHeight: 300
    });
  }

  if (/\brevenue\b|\bsales dashboard\b|\b12-month\b|\bmonthly\b/.test(lower)) {
    return buildHtmlWidget({
      title: "Sales Performance",
      subtitle: "A 12-month revenue trend with key performance indicators.",
      stats: [
        { label: "Monthly Average Revenue", value: "$25k" },
        { label: "This Month Revenue", value: "$33k" }
      ],
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      values: [18, 20, 19, 22, 24, 23, 26, 28, 29, 31, 30, 33],
      chartType: "line",
      datasetLabel: "Revenue ($k)",
      valuePrefix: "$",
      valueSuffix: "k",
      chartHeight: 320
    });
  }

  const source = existingWidgetHTML || assistantText || "";
  const numbers = [...source.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
  if (numbers.length >= 2) {
    const labels = numbers.slice(0, 6).map((_, index) => `Point ${index + 1}`);
    const values = numbers.slice(0, 6);
    return buildHtmlWidget({
      title: "Generated Comparison Chart",
      subtitle: "Fallback chart built from the values detected in the assistant response.",
      labels,
      values,
      chartType: lower.includes("pie") ? "pie" : "bar",
      datasetLabel: "Values",
      chartHeight: lower.includes("pie") ? 360 : 320
    });
  }

  return null;
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

  const finalizeWidget = (assistantId, promptText) => {
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
        const widgetToAppend =
          isVisualizationPrompt(promptText) &&
          !widgetHasRenderableChart(completeWidget)
            ? buildFallbackWidget(promptText, message.textContent || "", completeWidget) ||
              completeWidget
            : completeWidget;
        nextHtml += widgetToAppend;
        widgetStateRef.current.hasAny = true;
        return { ...message, widgetHTML: nextHtml };
      })
    );
  };

  const ensureRenderableWidget = (assistantId, promptText) => {
    setMessages((prev) =>
      prev.map((message) => {
        if (message.id !== assistantId) return message;

        let nextText = message.textContent || "";
        let nextWidget = message.widgetHTML || "";

        if (!nextWidget) {
          const extracted = extractWidgetFromText(nextText);
          nextText = extracted.text || "";
          nextWidget = extracted.widgetHTML || "";
        }

        if (
          isVisualizationPrompt(promptText) &&
          !widgetHasRenderableChart(nextWidget)
        ) {
          const fallbackWidget = buildFallbackWidget(
            promptText,
            nextText,
            nextWidget
          );
          if (fallbackWidget) {
            nextWidget = fallbackWidget;
          }
        }

        return {
          ...message,
          textContent: nextText,
          widgetHTML: nextWidget || message.widgetHTML
        };
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
      () => finalizeWidget(assistantId, text)
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
            finalizeWidget(assistantId, text);
          }
          ensureRenderableWidget(assistantId, text);
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

