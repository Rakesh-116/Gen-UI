// App.jsx - Root layout wiring sidebar and chat.
// App.jsx - Root layout wiring sidebar and chat.
import { useEffect, useMemo, useState } from "react";
import Chat from "./components/Chat.jsx";
import Sidebar from "./components/Sidebar.jsx";

export default function App() {
  const storageKey = "genui-settings";
  const defaultProvider = useMemo(
    () => (import.meta.env.VITE_AI_PROVIDER || "anthropic").toLowerCase(),
    []
  );
  const [settings, setSettings] = useState({
    tavilyKey: "",
    provider: defaultProvider,
    providerKey: ""
  });
  const enableOllama =
    (import.meta.env.VITE_ENABLE_OLLAMA || "false").toLowerCase() === "true";

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      setSettings((prev) => {
        const next = { ...prev, ...parsed };
        if (!enableOllama && next.provider === "ollama") {
          next.provider = defaultProvider;
        }
        return next;
      });
    } catch {
      // Ignore malformed settings.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(settings));
  }, [settings]);

  const handleSettingsChange = (next) => {
    setSettings((prev) => {
      const updated = { ...prev, ...next };
      if (next.provider && next.provider !== prev.provider) {
        updated.providerKey = "";
      }
      return updated;
    });
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      <div className="flex min-h-screen flex-col lg:h-screen lg:flex-row">
        <aside className="w-full shrink-0 border-b border-slate-200/60 lg:w-[300px] lg:border-b-0 lg:border-r">
          <div className="lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
            <Sidebar settings={settings} onChange={handleSettingsChange} />
          </div>
        </aside>
        <main className="min-h-0 flex-1 lg:overflow-y-auto">
          <Chat settings={settings} />
        </main>
      </div>
    </div>
  );
}

