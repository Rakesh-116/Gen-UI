// markdownRenderer.js - Converts markdown text into HTML for chat rendering.
import { marked } from "marked";

marked.setOptions({
  breaks: true,
  gfm: true
});

export function renderMarkdown(text) {
  if (!text) return "";
  return marked.parse(text);
}
