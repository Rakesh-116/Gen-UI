// markdownRenderer.js - Converts markdown text into HTML for chat rendering.
import { marked } from "marked";

marked.setOptions({
  breaks: true,
  gfm: true
});

const renderer = new marked.Renderer();
const defaultLinkRenderer = renderer.link.bind(renderer);

renderer.link = function link(token) {
  const html = defaultLinkRenderer(token);
  if (!html.includes("<a ")) return html;
  if (html.includes('target="_blank"')) return html;
  return html.replace("<a ", '<a target="_blank" rel="noreferrer" ');
};

export function renderMarkdown(text) {
  if (!text) return "";
  return marked.parse(text, { renderer });
}
