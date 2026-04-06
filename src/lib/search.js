// search.js - Tavily web search wrapper and response formatter.
const ENV_TAVILY_KEY = import.meta.env.VITE_TAVILY_API_KEY;

export async function searchWeb(query, overrideKey) {
  const apiKey = overrideKey || ENV_TAVILY_KEY;
  if (!apiKey) {
    throw new Error("Missing VITE_TAVILY_API_KEY.");
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: 3,
      include_answer: true
    })
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Tavily error ${res.status}`);
  }

  const data = await res.json();
  return {
    answer: data.answer || null,
    results: (data.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: (r.content || "").slice(0, 400)
    }))
  };
}

export function formatSearchContext(searchData) {
  let context = "## Real-time search results (use this data in your response)\n\n";

  if (searchData.answer) {
    context += `Quick answer: ${searchData.answer}\n\n`;
  }

  searchData.results.forEach((r, i) => {
    context += `Source ${i + 1}: ${r.title}\nURL: ${r.url}\nContent: ${r.snippet}\n\n`;
  });

  context += "## End of search results\n";
  context +=
    "Important: Base your response and any widgets on the above data. " +
    "Cite sources at the end of your text response.";

  return context;
}
