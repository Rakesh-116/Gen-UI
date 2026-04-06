// WidgetRenderer.jsx - Safely renders widget HTML inside an iframe.
import { useEffect, useRef, useState } from "react";

function getHtmlDiagnostics(html) {
  if (!html) return { nonAscii: [], control: [] };
  const nonAscii = [];
  const control = [];
  for (let i = 0; i < html.length; i += 1) {
    const code = html.charCodeAt(i);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      if (control.length < 20) control.push({ index: i, code });
    } else if (code > 126) {
      if (nonAscii.length < 20) nonAscii.push({ index: i, code });
    }
  }
  return { nonAscii, control };
}

function formatWithLineNumbers(html) {
  if (!html) return "";
  const lines = html.split("\n");
  const pad = String(lines.length).length;
  return lines
    .map((line, idx) => String(idx + 1).padStart(pad, "0") + ": " + line)
    .join("\n");
}
export default function WidgetRenderer({ html }) {
  const iframeRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const sanitizedHtml = html ? normalizeWidgetHtml(html) : html;
  const debugEnabled =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("debugWidget");
  const diagnostics = debugEnabled ? getHtmlDiagnostics(sanitizedHtml) : null;
  const numberedHtml = debugEnabled ? formatWithLineNumbers(sanitizedHtml) : "";

  useEffect(() => {
    setIsLoading(true);
  }, [sanitizedHtml]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      setIsLoading(false);
    };

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [sanitizedHtml]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleMessage = (event) => {
      if (event.source !== iframe.contentWindow) return;
      if (!event.data || event.data.type !== "widget-height") return;
      const nextHeight = Math.max(320, Math.ceil(event.data.height || 0));
      iframe.style.height = `${nextHeight}px`;
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [sanitizedHtml]);

  return (
    <div className="relative mt-3 w-full">
      {isLoading ? (
        <div className="absolute inset-0 animate-pulse rounded-xl bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100" />
      ) : null}
      <iframe
        ref={iframeRef}
        title="Generated widget"
        sandbox="allow-scripts"
        srcDoc={sanitizedHtml}
        className="relative w-full border-none"
        style={{ minHeight: "240px" }}
        scrolling="no"
      />
      {debugEnabled ? (
        <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <summary className="cursor-pointer select-none font-semibold text-slate-700">
            Widget Debug
          </summary>
          <div className="mt-2 space-y-2">
            <div className="font-semibold">Non-ASCII/Control Characters</div>
            <pre className="whitespace-pre-wrap break-all text-[11px] text-slate-600">
              {JSON.stringify(diagnostics, null, 2)}
            </pre>
            <div className="font-semibold">HTML With Line Numbers</div>
            <pre className="max-h-64 overflow-auto whitespace-pre text-[11px] text-slate-600">
              {numberedHtml}
            </pre>
            <div className="font-semibold">Raw HTML</div>
            <textarea
              readOnly
              value={sanitizedHtml || ""}
              className="h-48 w-full rounded-md border border-slate-200 bg-white p-2 font-mono text-[11px]"
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function normalizeWidgetHtml(rawHtml) {
  const chartUmd =
    "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";

  let next = rawHtml
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/&ldquo;|&rdquo;|&quot;/gi, '"')
    .replace(/&lsquo;|&rsquo;/gi, "'")
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/[\u00A0\u2007\u202F]/g, " ")
    .replace(/[\u2028\u2029]/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/https?:\/\/[^\s"'<>]*chart\.min\.js/gi, chartUmd)
    .replace(/https?:\/\/[^\s"'<>]*chart\.js/gi, chartUmd)
    .replace(/^data:\s?.*$/gim, "");

  next = next.replace(/<canvas([^>]*)>/gi, (match, attrs = "") => {
    const cleaned = attrs
      .replace(/\swidth=["'][^"']*["']/i, "")
      .replace(/\sheight=["'][^"']*["']/i, "")
      .trim();
    return `<canvas ${cleaned}></canvas>`;
  });

  const inlineScripts = [];
  next = next.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs = "", code = "") => {
    const hasSrc = /\bsrc\s*=/.test(attrs);
    if (hasSrc) return match;

    const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i);
    const type = typeMatch ? typeMatch[1].toLowerCase() : "";
    const isJs =
      !type ||
      type.includes("javascript") ||
      type.includes("ecmascript") ||
      type.includes("module");
    if (!isJs) return match;

    const cleaned = code
      .replace(/^data:\s?.*$/gim, "")
      .replace(/```[a-zA-Z]*\n?/g, "")
      .replace(/```/g, "")
      .replace(/<artifact[^>]*>/gi, "")
      .replace(/<\/artifact>/gi, "")
      .replace(/<!--/g, "")
      .replace(/-->/g, "")
      .replace(/(\d),(?=\d{3}\b)/g, "$1")
      .replace(/[\u2028\u2029]/g, " ")
      .replace(/[\u00A0\u2007\u202F]/g, " ")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/–|—/g, "-")
      .trim();
    if (cleaned) {
      const isModule = type.includes("module");
      const escaped = cleaned.replace(/<\/script>/gi, "<\/script>");
      inlineScripts.push({ code: escaped, isModule });
    }
    return "";
  });

  const chartHelper = `<script>
(function () {
  if (window.__widgetEnsureChart) return;
  window.__widgetEnsureChart = function (cb) {
    const run = () => {
      try { cb(); } catch (err) { console.error(err); }
    };
    if (window.Chart) {
      run();
      return;
    }
    const existing = document.querySelector('script[src*="chart.umd.js"]');
    if (existing && existing.dataset.loaded === \"true\") {
      run();
      return;
    }
    const script = existing || document.createElement('script');
    if (!existing) {
      script.src = \"${chartUmd}\";
      script.onload = () => {
        script.dataset.loaded = \"true\";
        run();
      };
      script.onerror = () => {
        console.error(\"Chart.js failed to load\");
        run();
      };
      document.head.appendChild(script);
    } else {
      existing.addEventListener('load', run, { once: true });
    }
  };
})();
</script>`;

  const chartScriptTag = `<script src=\"${chartUmd}\"></script>`;
  if (!next.match(/<script[^>]*src=[\"'][^\"']*chart[^\"']*[\"'][^>]*>/i)) {
    if (next.includes(\"</head>\")) {
      next = next.replace(\"</head>\", `${chartScriptTag}</head>`);
    } else {
      next = `<head>${chartScriptTag}</head>` + next;
    }
  }

  if (next.includes(\"</head>\")) {
    next = next.replace(\"</head>\", `${chartHelper}</head>`);
  } else {
    next = `<head>${chartHelper}</head>` + next;
  }

  const canvasStyle = `<style>
*{box-sizing:border-box;max-width:100%;}
html,body{width:100%;margin:0;background:transparent;overflow-x:hidden;}
img,svg,canvas,video{max-width:100% !important;height:auto !important;display:block;}
canvas{width:100% !important;height:280px !important;}
</style>`;
  if (next.includes("</head>")) {
    next = next.replace("</head>", `${canvasStyle}</head>`);
  } else {
    next = `${canvasStyle}${next}`;
  }

  if (inlineScripts.length > 0) {
    const wrapped = inlineScripts
      .map(({ code, isModule }) => {
        const needsModule = isModule || /\bimport\s+|\bexport\s+/.test(code);
        if (needsModule) {
          return `<script type=\"module\">${code}</script>`;
        }
        return `<script>window.__widgetEnsureChart ? window.__widgetEnsureChart(function () { ${code} }) : window.addEventListener('load', function () { ${code} });</script>`;
      })
      .join("");
    if (next.includes("</body>")) {
      next = next.replace("</body>", `${wrapped}</body>`);
    } else {
      next += wrapped;
    }
  }

  const runner = `
<script>
(function () {
  const resizeCanvas = () => {
    const dpr = window.devicePixelRatio || 1;
    document.querySelectorAll('canvas').forEach((canvas) => {
      const rect = canvas.getBoundingClientRect();
      const fallbackWidth = canvas.parentElement ? canvas.parentElement.clientWidth : 600;
      const fallbackHeight = canvas.parentElement ? canvas.parentElement.clientHeight : 320;
      const width = rect.width || fallbackWidth || 600;
      const height = rect.height || fallbackHeight || 320;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
    });
    requestAnimationFrame(() => {
      const height = document.body.scrollHeight;
      if (window.parent) {
        window.parent.postMessage({ type: 'widget-height', height }, '*');
      }
    });
  };
  const ensureLegend = () => {
    if (!document.getElementById('legend')) {
      const legend = document.createElement('div');
      legend.id = 'legend';
      legend.className = 'legend';
      const anchor = document.body.firstElementChild;
      if (anchor) {
        anchor.insertAdjacentElement('afterend', legend);
      } else {
        document.body.prepend(legend);
      }
    }
  };
  const ensureChart = () => {
    if (window.Chart) {
      ensureLegend();
      resizeCanvas();
      return;
    }
    const existing = document.querySelector('script[src*="chart"]');
    if (existing && existing.dataset.loaded === "true") {
      ensureLegend();
      resizeCanvas();
      return;
    }
    const script = document.createElement('script');
    script.src = "${chartUmd}";
    script.onload = () => {
      script.dataset.loaded = "true";
      ensureLegend();
      resizeCanvas();
    };
    script.onerror = () => {
      console.error("Chart.js failed to load");
      ensureLegend();
      resizeCanvas();
    };
    document.head.appendChild(script);
  };
  if (document.readyState === 'complete') {
    ensureChart();
  } else {
    window.addEventListener('load', ensureChart);
  }
  try {
    const ro = new ResizeObserver(() => {
      const height = document.body.scrollHeight;
      if (window.parent) {
        window.parent.postMessage({ type: 'widget-height', height }, '*');
      }
    });
    ro.observe(document.body);
  } catch (err) {}
})();
</script>`;

  if (next.includes("</body>")) {
    next = next.replace("</body>", `${runner}</body>`);
  } else {
    next += runner;
  }

  return next;
}

