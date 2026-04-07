// InputBar.jsx - Text input composer for sending messages.
import { useState } from "react";

export default function InputBar({ onSend, disabled }) {
  const [value, setValue] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!value.trim()) return;
    onSend(value);
    setValue("");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)] sm:mt-6 sm:flex-row sm:items-end"
    >
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask for a chart, dashboard, or calculation..."
        rows={2}
        className="min-h-[96px] w-full flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 sm:min-h-[44px] sm:px-3"
        disabled={disabled}
      />
      <button
        type="submit"
        disabled={disabled}
        className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto sm:py-2"
      >
        Send
      </button>
    </form>
  );
}
