// intentDetector.js - Heuristics to decide when to call web search.
const SEARCH_TRIGGERS = [
  "latest",
  "current",
  "today",
  "2024",
  "2025",
  "2026",
  "recent",
  "now",
  "how many",
  "exact",
  "actual",
  "real",
  "news",
  "price",
  "count",
  "number of",
  "statistics",
  "data",
  "trend",
  "report"
];

export function needsSearch(userMessage) {
  const lower = userMessage.toLowerCase();
  return SEARCH_TRIGGERS.some((trigger) => lower.includes(trigger));
}

export function extractSearchQuery(userMessage) {
  return userMessage
    .replace(/can you|could you|please|i want to know|tell me|give me/gi, "")
    .trim();
}
