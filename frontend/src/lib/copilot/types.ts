// POC-08 AI Operations Copilot — shared shapes.
//
// The architecture in spec section 12.1 is deliberate:
//
//   User -> Copilot -> Tool/API layer -> Operational data -> ML/Rules
//        -> Structured result -> language layer -> Explanation
//
// The language layer never computes risk. Every number a copilot answer
// states is produced by the same Health / Anomaly / Risk / Recommendation
// engines the dashboard reads, surfaced here as a `ToolResult`. That is what
// keeps the answers and the screens from ever disagreeing.

/** One fact backing an answer — rendered as a source chip (guardrail 12.3). */
export interface Evidence {
  label: string;
  value: string;
  href?: string;
}

/** The structured output of a tool call, before any prose is written. */
export interface ToolResult {
  tool: string;
  /** Short headline the language layer opens with. */
  headline: string;
  bullets: string[];
  evidence: Evidence[];
  links: { label: string; href: string }[];
  /** Uncertainty / scope statement. Guardrail: always state the limits. */
  caveat?: string;
}

export interface CopilotAnswer extends ToolResult {
  intent: Intent;
  /** Prose from the platform's own /copilot/ask, present only once an LLM key
   * is configured on that side. Null means the wording below is ours. */
  platformAnswer?: string | null;
  platformNote?: string | null;
}

export type Intent =
  | "attention_today"
  | "explain_risk"
  | "top_critical_stations"
  | "recent_changes"
  | "engineer_checks"
  | "trend_search"
  | "operational_summary"
  | "compare_assets"
  | "deteriorating"
  | "asset_lookup"
  | "capabilities"
  | "unavailable"
  | "unknown";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  answer?: CopilotAnswer;
}

/** The example questions from spec sections 11 (screen 5) and 12.2. */
export const SUGGESTED_QUESTIONS = [
  "Which assets are likely to require attention today?",
  "Why is BAT001 at risk?",
  "What are the top 5 critical stations?",
  "What should the field engineer check on BAT001?",
  "Which assets are showing increasing charging time?",
  "Give me today's operational summary.",
] as const;
