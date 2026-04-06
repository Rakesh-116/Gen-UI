// MessageBubble.jsx - Renders a single chat message, including widgets when present.
import WidgetRenderer from "./WidgetRenderer.jsx";
import { renderMarkdown } from "../lib/markdownRenderer.js";

const WIDGET_SPLIT = "\n<!-- WIDGET_SPLIT -->\n";

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

        {message.status === "error" ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            Something went wrong while streaming the response.
          </div>
        ) : null}
      </div>
    </div>
  );
}
