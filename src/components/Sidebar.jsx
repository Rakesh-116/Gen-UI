// Sidebar.jsx - Left rail for API keys and provider selection.
import { useMemo } from "react";

const PROVIDERS = [
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    link: "https://console.anthropic.com/"
  },
  {
    id: "openai",
    label: "OpenAI",
    link: "https://platform.openai.com/api-keys"
  },
  {
    id: "gemini",
    label: "Gemini",
    link: "https://aistudio.google.com/app/apikey"
  },
  {
    id: "groq",
    label: "Groq",
    link: "https://console.groq.com/keys"
  },
  {
    id: "ollama",
    label: "Ollama (Local)",
    link: "https://ollama.com/"
  }
];

function ExternalLinkIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 5h8v8" />
      <path d="M15 5 5 15" />
    </svg>
  );
}

function HelpLink({ href, children }) {
  return (
    <a
      className="inline-flex items-center gap-1.5 text-xs text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      <span>{children}</span>
      <ExternalLinkIcon />
    </a>
  );
}

export default function Sidebar({ settings, onChange }) {
  const showOllama =
    (import.meta.env.VITE_ENABLE_OLLAMA || "false").toLowerCase() === "true";
  const providerOptions = showOllama
    ? PROVIDERS
    : PROVIDERS.filter((provider) => provider.id !== "ollama");
  const activeProvider = useMemo(
    () => PROVIDERS.find((p) => p.id === settings.provider),
    [settings.provider]
  );
  const providerLabel = activeProvider?.label || "Provider";

  return (
    <aside className="flex h-full w-full flex-col gap-6 border-r border-slate-200/70 bg-white/70 px-5 py-6 text-sm text-slate-700 backdrop-blur">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-400">
          Keys & Providers
        </p>
        <h2 className="mt-2 font-display text-lg font-semibold text-slate-900">
          Configure Your Session
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Keys are stored locally in your browser for quick testing.
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Tavily Search Key
        </label>
        <input
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
          type="password"
          placeholder="tvly-..."
          value={settings.tavilyKey}
          onChange={(event) => onChange({ tavilyKey: event.target.value })}
        />
        <HelpLink href="https://app.tavily.com/home">
          Get a Tavily API key
        </HelpLink>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          AI Provider
        </label>
        <select
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
          value={settings.provider}
          onChange={(event) => onChange({ provider: event.target.value })}
        >
          {providerOptions.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>
        {activeProvider ? (
          <HelpLink href={activeProvider.link}>
            Get a {activeProvider.label} API key
          </HelpLink>
        ) : null}
      </div>

      {settings.provider !== "ollama" ? (
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            {providerLabel} API Key
          </label>
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
            type="password"
            placeholder={`Enter ${providerLabel} key`}
            value={settings.providerKey}
            onChange={(event) => onChange({ providerKey: event.target.value })}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-3 text-xs text-slate-500">
          Ollama runs locally. No API key required.
        </div>
      )}

      <div className="rounded-xl border border-slate-200/70 bg-white/80 px-4 py-4 text-xs text-slate-500">
        <p className="font-semibold text-slate-700">Tip</p>
        <p className="mt-1">
          Swap providers anytime. Your keys stay on this device only.
        </p>
      </div>
    </aside>
  );
}

