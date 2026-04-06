// streaming.js - Helpers to read streaming responses (SSE and NDJSON).
export async function streamSse(response, onJson) {
  if (!response.ok) {
    const message = await safeReadError(response);
    throw new Error(message || `Request failed with ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body to read.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let lineEnd = buffer.indexOf("\n");
    while (lineEnd !== -1) {
      const line = buffer.slice(0, lineEnd).trim();
      buffer = buffer.slice(lineEnd + 1);
      lineEnd = buffer.indexOf("\n");

      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;

      try {
        const json = JSON.parse(data);
        onJson(json);
      } catch {
        // Ignore malformed chunks.
      }
    }
  }
}

export async function streamNdjson(response, onJson) {
  if (!response.ok) {
    const message = await safeReadError(response);
    throw new Error(message || `Request failed with ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body to read.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let lineEnd = buffer.indexOf("\n");
    while (lineEnd !== -1) {
      const line = buffer.slice(0, lineEnd).trim();
      buffer = buffer.slice(lineEnd + 1);
      lineEnd = buffer.indexOf("\n");

      if (!line) continue;
      try {
        const json = JSON.parse(line);
        onJson(json);
      } catch {
        // Ignore malformed chunks.
      }
    }
  }
}

async function safeReadError(response) {
  try {
    return await response.text();
  } catch {
    return null;
  }
}
