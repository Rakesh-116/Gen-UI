import { useEffect, useMemo, useRef, useState } from "react";

function sanitizeForIframe(html) {
  return html
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u200B/g, "")
    .replace(/\u00A0/g, " ");
}

function ensureChartJs(html) {
  const cdn =
    "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";

  if (html.includes("Chart.js") || html.includes("chart.umd")) {
    return html;
  }

  if (html.includes("<head>")) {
    return html.replace("<head>", `<head>\n<script src="${cdn}"><\/script>`);
  }

  return `<script src="${cdn}"><\/script>\n${html}`;
}

function wrapIfFragment(html) {
  const trimmed = html.trim();

  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    return html;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"><\/script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 20px;
      background: transparent;
      color: #111827;
    }
  </style>
</head>
<body>${trimmed}</body>
</html>`;
}

function prepareHtml(rawHtml) {
  let html = sanitizeForIframe(rawHtml);
  html = ensureChartJs(html);
  html = wrapIfFragment(html);
  return html;
}

export default function WidgetRenderer({ html }) {
  const iframeRef = useRef(null);
  const [height, setHeight] = useState(400);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handler = (event) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      if (event.data?.type === "WIDGET_RESIZE") {
        setHeight(Math.max(200, Number(event.data.height || 0) + 32));
      }

      if (event.data?.type === "WIDGET_ERROR") {
        console.error(
          "[Widget Error]",
          event.data.message,
          "line:",
          event.data.line
        );
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    setLoading(true);
    setHeight(400);
  }, [html]);

  const finalHtml = useMemo(() => {
    const errorBridge = `
<script>
  window.onerror = function(msg, src, line, col, err) {
    window.parent.postMessage({ type: "WIDGET_ERROR", message: msg, line: line }, "*");
  };
<\/script>`;

    const resizeBridge = `
<script>
  function reportHeight() {
    var h = document.documentElement.scrollHeight || document.body.scrollHeight;
    window.parent.postMessage({ type: "WIDGET_RESIZE", height: h }, "*");
  }

  window.addEventListener("load", function() {
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        reportHeight();
      });
    });
  });
<\/script>`;

    return prepareHtml(html)
      .replace("<head>", `<head>${errorBridge}`)
      .replace("</body>", `${resizeBridge}</body>`);
  }, [html]);

  return (
    <div className="mt-2 w-full overflow-hidden rounded-lg border border-slate-200">
      {loading ? (
        <div className="flex h-[200px] items-center justify-center bg-slate-50 text-sm text-slate-400">
          Loading widget...
        </div>
      ) : null}
      <iframe
        ref={iframeRef}
        srcDoc={finalHtml}
        sandbox="allow-scripts"
        title="Generated widget"
        style={{
          width: "100%",
          height,
          border: "none",
          display: loading ? "none" : "block"
        }}
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
