import type { Config } from "@netlify/functions";

function json(data: Record<string, unknown>, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function normalizeHandle(value: string) {
  return value.replace(/^@+/, "").trim().toLowerCase();
}

function stripTags(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function getSearchSignals(html: string, handle: string) {
  const profileLinkFound = hasExactInstagramProfileUrl(html, handle);
  const text = stripTags(html);
  const lowerText = text.toLowerCase();
  const handleIndex = lowerText.indexOf(handle);
  const snippet = handleIndex >= 0
    ? text.slice(Math.max(0, handleIndex - 180), handleIndex + 420)
    : text.slice(0, 520);

  return {
    exactUrlFound: profileLinkFound,
    profileLinkFound,
    snippet,
  };
}

function hasExactInstagramProfileUrl(value: string, handle: string) {
  const escaped = handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(?:https?:\\/\\/)?(?:www\\.)?instagram\\.com\\/${escaped}(?:\\/?|[?#][^\\s"'<>]*)`,
    "i",
  );
  return pattern.test(value);
}

function isExactInstagramProfileResult(value: unknown, handle: string) {
  if (typeof value !== "string" || !value) return false;
  try {
    const parsed = new URL(value.startsWith("http") ? value : `https://${value}`);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "instagram.com") return false;
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts.length === 1 && parts[0].toLowerCase() === handle;
  } catch (error) {
    return hasExactInstagramProfileUrl(value, handle);
  }
}

async function fetchWithTimeout(url: string, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; IGAccountCheck/1.0; +https://kumabuy-official-igcheck-v3.netlify.app/)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function getResultSignals(results: Array<Record<string, unknown>>, handle: string) {
  const matchedResults = results.filter((item) => {
    return isExactInstagramProfileResult(item.url, handle);
  });
  const snippet = matchedResults
    .slice(0, 3)
    .map((item) => [item.title, item.url, item.content || item.snippet].filter(Boolean).join(" - "))
    .join("\n");

  return {
    matched: matchedResults.length > 0,
    snippet,
    count: matchedResults.length,
  };
}

async function searchWithTavily(handle: string) {
  const apiKey = Netlify.env.get("TAVILY_API_KEY");
  if (!apiKey) return null;

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `site:instagram.com/${handle} ${handle} Instagram`,
      search_depth: "basic",
      max_results: 8,
      include_domains: ["instagram.com"],
      include_answer: false,
      include_raw_content: false,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  const results = Array.isArray(payload.results) ? payload.results : [];
  const signals = getResultSignals(results, handle);
  return {
    status: response.status,
    ok: response.ok,
    matched: response.ok && signals.matched,
    snippet: signals.snippet,
    resultCount: results.length,
    matchedCount: signals.count,
    error: response.ok ? null : payload?.error || payload?.detail || "Tavily request failed",
  };
}

async function searchWithExa(handle: string) {
  const apiKey = Netlify.env.get("EXA_API_KEY");
  if (!apiKey) return null;

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `"instagram.com/${handle}" OR "www.instagram.com/${handle}" "${handle}"`,
      type: "auto",
      numResults: 8,
      contents: {
        highlights: {
          numSentences: 2,
          highlightsPerUrl: 1,
        },
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  const results = Array.isArray(payload.results) ? payload.results : [];
  const normalizedResults = results.map((item: Record<string, unknown>) => ({
    ...item,
    content: [
      item.text,
      Array.isArray(item.highlights) ? item.highlights.join(" ") : "",
      item.summary,
    ].filter(Boolean).join(" "),
  }));
  const signals = getResultSignals(normalizedResults, handle);
  return {
    status: response.status,
    ok: response.ok,
    matched: response.ok && signals.matched,
    snippet: signals.snippet,
    resultCount: results.length,
    matchedCount: signals.count,
    error: response.ok ? null : payload?.error || payload?.message || "Exa request failed",
  };
}

export default async (req: Request) => {
  if (req.method !== "GET") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);
  const handle = normalizeHandle(url.searchParams.get("handle") || "");
  if (!/^[a-z0-9._]{2,30}$/.test(handle)) {
    return json({ success: false, exists: false, error: "Invalid Instagram handle" }, 400);
  }

  const profileUrl = `https://www.instagram.com/${handle}/`;
  const searchQuery = encodeURIComponent(`site:instagram.com/${handle} ${handle}`);
  const searchUrl = `https://duckduckgo.com/html/?q=${searchQuery}`;
  const sources: Array<Record<string, unknown>> = [];

  try {
    const exaResult = await searchWithExa(handle).catch((error) => ({
      status: 0,
      ok: false,
      matched: false,
      snippet: "",
      resultCount: 0,
      matchedCount: 0,
      error: error instanceof Error ? error.message : "Exa request failed",
    }));
    let exaSignal = false;
    let exaSnippet = "";
    if (exaResult) {
      exaSignal = exaResult.matched;
      exaSnippet = exaResult.snippet;
      sources.push({
        type: "exa",
        status: exaResult.status,
        matched: exaSignal,
        resultCount: exaResult.resultCount,
        matchedCount: exaResult.matchedCount,
        error: exaResult.error,
      });
    }

    const tavilyResult = await searchWithTavily(handle).catch((error) => ({
      status: 0,
      ok: false,
      matched: false,
      snippet: "",
      resultCount: 0,
      matchedCount: 0,
      error: error instanceof Error ? error.message : "Tavily request failed",
    }));
    let tavilySignal = false;
    let tavilySnippet = "";
    if (tavilyResult) {
      tavilySignal = tavilyResult.matched;
      tavilySnippet = tavilyResult.snippet;
      sources.push({
        type: "tavily",
        status: tavilyResult.status,
        matched: tavilySignal,
        resultCount: tavilyResult.resultCount,
        matchedCount: tavilyResult.matchedCount,
        error: tavilyResult.error,
      });
    }

    const [directResponse, searchResponse] = await Promise.allSettled([
      fetchWithTimeout(profileUrl),
      fetchWithTimeout(searchUrl),
    ]);

    if (directResponse.status === "fulfilled") {
      const html = await directResponse.value.text().catch(() => "");
      const status = directResponse.value.status;
      sources.push({
        type: "direct",
        status,
        matched: false,
        note: "direct instagram html is recorded only; it is not used to verify account existence",
        url: profileUrl,
      });
    }

    let searchSignal = false;
    let searchSnippet = "";
    if (searchResponse.status === "fulfilled" && searchResponse.value.ok) {
      const html = await searchResponse.value.text();
      const signals = getSearchSignals(html, handle);
      searchSignal = false;
      searchSnippet = signals.snippet;
      sources.push({
        type: "search",
        status: searchResponse.value.status,
        matched: searchSignal,
        note: "raw search html is recorded only; it is not used to verify account existence",
        url: searchUrl,
      });
    }

    const exists = exaSignal || tavilySignal;
    return json({
      success: true,
      exists,
      handle,
      profileUrl,
      source: exaSignal ? "exa_search" : tavilySignal ? "tavily_search" : "not_found",
      snippet: exaSnippet || tavilySnippet || searchSnippet,
      sources,
    });
  } catch (error) {
    return json({
      success: false,
      exists: false,
      handle,
      profileUrl,
      error: "Unable to verify Instagram account right now",
      sources,
    }, 502);
  }
};

export const config: Config = {
  path: "/api/lookup-instagram",
  method: ["GET"],
};
