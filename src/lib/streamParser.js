// streamParser.js - Parses assistant output streams into text and widget HTML chunks.
export function createStreamParser(onText, onWidgetChunk, onWidgetEnd) {
  let buffer = "";
  let inWidget = false;
  let closeToken = "</artifact>";
  const ALT_OPEN = "<!DOCTYPE html";
  const ALT_CLOSE = "</html>";
  const ARTIFACT_OPEN_RE = /<artifact\s+type\s*=\s*["']html["']\s*>/i;

  function processChunk(chunk) {
    buffer += chunk;

    if (!inWidget) {
      const openMatch = buffer.match(ARTIFACT_OPEN_RE);
      const openIdx = openMatch ? buffer.indexOf(openMatch[0]) : -1;
      const altIdx = buffer.indexOf(ALT_OPEN);
      const hasArtifact = openIdx !== -1;
      const hasAlt = altIdx !== -1;
      const useAlt = hasAlt && (!hasArtifact || altIdx < openIdx);

      if (!hasArtifact && !hasAlt) {
        const safeEnd = buffer.length - closeToken.length;
        if (safeEnd > 0) {
          onText(buffer.slice(0, safeEnd));
          buffer = buffer.slice(safeEnd);
        }
      } else if (useAlt) {
        onText(buffer.slice(0, altIdx));
        buffer = buffer.slice(altIdx);
        inWidget = true;
        closeToken = ALT_CLOSE;
      } else {
        onText(buffer.slice(0, openIdx));
        buffer = buffer.slice(openIdx + openMatch[0].length);
        inWidget = true;
        closeToken = "</artifact>";
      }
    }

    if (inWidget) {
      const closeIdx = buffer.toLowerCase().indexOf(closeToken);
      if (closeIdx === -1) {
        const safeEnd = buffer.length - closeToken.length;
        if (safeEnd > 0) {
          onWidgetChunk(buffer.slice(0, safeEnd));
          buffer = buffer.slice(safeEnd);
        }
      } else {
        onWidgetChunk(buffer.slice(0, closeIdx));
        onWidgetEnd();
        buffer = buffer.slice(closeIdx + closeToken.length);
        inWidget = false;
        closeToken = "</artifact>";
      }
    }
  }

  function flush() {
    if (!buffer) return;

    if (inWidget) {
      onWidgetChunk(buffer);
      onWidgetEnd();
    } else {
      onText(buffer);
    }

    buffer = "";
    inWidget = false;
  }

  return { processChunk, flush };
}
