// Calls the platform's own POST /copilot/ask.
//
// Today that endpoint returns `answer: null` with
// `note: "ANTHROPIC_API_KEY not configured"`, and its `context` is the same
// generic network summary for every question — so it cannot answer on its own.
// We still call it, because the moment a key is configured server-side its
// `answer` becomes real LLM prose, and that is better phrasing than a template.
// Until then the local tool layer supplies the wording.

import { apiBaseUrl } from "@/lib/api/client";

export interface ServerAnswer {
  answer: string | null;
  llmUsed: boolean;
  note: string | null;
}

const TIMEOUT_MS = 12000;

export async function askPlatformCopilot(
  question: string,
  assetId?: string | null,
): Promise<ServerAnswer | null> {
  const base = apiBaseUrl();
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/copilot/ask`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(assetId ? { question, asset_id: assetId } : { question }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      answer?: string | null;
      llm_used?: boolean;
      note?: string | null;
    };
    const answer = typeof data.answer === "string" && data.answer.trim() ? data.answer.trim() : null;
    return { answer, llmUsed: Boolean(data.llm_used), note: data.note ?? null };
  } catch {
    // A copilot answer is still useful without the platform's prose.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
