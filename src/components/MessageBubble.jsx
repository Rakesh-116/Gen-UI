// MessageBubble.jsx - Renders a single chat message, including widgets when present.
import WidgetRenderer from "./WidgetRenderer.jsx";
import { renderMarkdown } from "../lib/markdownRenderer.js";

const WIDGET_SPLIT = "\n<!-- WIDGET_SPLIT -->\n";

function ErrorCard({ message }) {
  return (
    <div className="max-w-3xl overflow-hidden rounded-2xl border border-rose-200 bg-[linear-gradient(135deg,rgba(255,241,242,0.95),rgba(255,255,255,0.96))] shadow-[0_14px_40px_rgba(244,63,94,0.08)]">
      <div className="flex items-start gap-3 px-4 py-4">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="10" cy="10" r="7" />
            <path d="M10 6.5v4.5" />
            <path d="M10 13.7h.01" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-rose-700">
            Response couldn't finish
          </p>
          <p className="mt-1 text-sm leading-6 text-rose-700/90">
            {message.errorMessage || "Something went wrong while streaming the response."}
          </p>
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-rose-500">
            Try again, switch providers, or paste your own API key in the sidebar.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";
  const hasText = Boolean(message.textContent?.trim());
  const hasWidget = Boolean(message.widgetHTML?.trim());
  const widgets = hasWidget ? message.widgetHTML.split(WIDGET_SPLIT) : [];

  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div className="max-w-[70%] rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-sm">
          {hasText ? (
            <div
              className="markdown text-sm leading-relaxed text-white"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(message.textContent) }}
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-start">
      <div className="w-full space-y-4 text-slate-900">
        {hasText ? (
          <div
            className="markdown max-w-3xl text-sm leading-relaxed text-slate-800"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.textContent) }}
          />
        ) : null}

        {message.status === "streaming" ? (
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Thinking
          </div>
        ) : null}

        {message.isSearching ? (
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-blue-400" />
            Searching the web
          </div>
        ) : null}

        {widgets.map((widget, index) => (
          <div key={`${message.id}-widget-${index}`} className="w-full max-w-5xl">
            <WidgetRenderer html={widget} />
          </div>
        ))}

        {message.status === "error" ? <ErrorCard message={message} /> : null}
      </div>
    </div>
  );
}
