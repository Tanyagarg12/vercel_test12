// POC-08 tool / API layer — backed by the live service.
//
// Each function is a "tool" the copilot can call. Tools read the already-scored
// fleet from the API; they never re-derive risk, and they never invent
// telemetry (guardrail 12.3). Anything the service cannot answer is reported as
// unavailable, with the reason, rather than guessed at.

import {
  fetchBatteries,
  fetchBattery,
  fetchChargers,
  fetchCommandCenter,
  fetchStations,
} from "@/lib/api/client";
import {
  normaliseBattery,
  normaliseBatteryDetail,
  normaliseStation,
  riskCategory,
  type BatteryDetailView,
  type BatteryRow,
  type StationRow,
} from "@/lib/api/normalise";
import type { ApiCommandCenter } from "@/lib/api/types";
import type { Evidence, ToolResult } from "./types";

const RISK_LANGUAGE =
  "Predictive risk / early warning from current health and anomaly signals — not a confirmed failure.";

/** Everything a tool might need, fetched once per question. */
export interface FleetSnapshot {
  batteries: BatteryRow[];
  stations: StationRow[];
  commandCenter: ApiCommandCenter | null;
  chargersFaulty: number;
}

export async function loadSnapshot(): Promise<FleetSnapshot> {
  const [batteries, stations, commandCenter, chargers] = await Promise.all([
    fetchBatteries().then((rows) => rows.map(normaliseBattery)),
    fetchStations()
      .then((rows) => rows.map(normaliseStation))
      .catch(() => []),
    fetchCommandCenter().catch(() => null),
    fetchChargers().catch(() => []),
  ]);
  return {
    batteries,
    stations,
    commandCenter,
    chargersFaulty: chargers.filter((c) => c.faulty).length,
  };
}

const RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MODERATE: 2, LOW: 1 };

function byRiskDesc(a: BatteryRow, b: BatteryRow): number {
  return (
    RANK[b.riskCategory] - RANK[a.riskCategory] ||
    b.riskScore - a.riskScore ||
    b.anomalyScore - a.anomalyScore
  );
}

/** Anything above Low is worth surfacing; the fleet may have no High/Critical at all. */
export function actionable(batteries: BatteryRow[]): BatteryRow[] {
  return batteries.filter((b) => b.riskCategory !== "LOW").sort(byRiskDesc);
}

function batteryLink(id: string) {
  return { label: id, href: `/batteries/${id}` };
}

function describeBattery(b: BatteryRow): string {
  return (
    `${b.batteryId} — ${Math.round(b.riskScore)}% risk (${b.riskCategory.toLowerCase()}), ` +
    `health ${b.healthScore}/100, anomaly ${Math.round(b.anomalyScore)} (${b.anomalySeverity.toLowerCase()}), ` +
    `${b.priority} · ${b.likelyIssue}`
  );
}

// --------------------------------------------------------------------------
// Tools
// --------------------------------------------------------------------------

/** "Which assets are likely to require attention today?" */
export function toolAttentionToday(snap: FleetSnapshot, limit = 6): ToolResult {
  const queue = actionable(snap.batteries);
  const top = queue.slice(0, limit);
  const cc = snap.commandCenter;

  if (top.length === 0) {
    return {
      tool: "attention_today",
      headline: "No battery needs attention today.",
      bullets: [
        `All ${snap.batteries.length} packs are in the Low predictive-risk band.`,
        ...(snap.chargersFaulty > 0
          ? [`${snap.chargersFaulty} charger(s) are reporting a fault and are worth a look.`]
          : []),
      ],
      evidence: [{ label: "Source", value: "Battery fleet register", href: "/batteries" }],
      links: [{ label: "Open the battery list", href: "/batteries" }],
      caveat: RISK_LANGUAGE,
    };
  }

  const evidence: Evidence[] = [
    { label: "Above Low risk", value: `${queue.length} of ${snap.batteries.length} packs` },
  ];
  if (cc) {
    evidence.push(
      { label: "High risk count", value: `${cc.batteries.high_risk_count}` },
      { label: "Predicted failures", value: `${cc.batteries.predicted_failure_count}` },
    );
  }
  evidence.push({ label: "Source", value: "Battery fleet register", href: "/batteries" });

  return {
    tool: "attention_today",
    headline: `${queue.length} batteries are above the Low risk band — the ${top.length} highest are listed below.`,
    bullets: top.map(describeBattery),
    evidence,
    links: [{ label: "Battery list", href: "/batteries" }, ...top.slice(0, 3).map((b) => batteryLink(b.batteryId))],
    caveat: RISK_LANGUAGE,
  };
}

/** "Why is <battery> at risk?" — the Explain responsibility (12.2). */
export function toolExplainBattery(detail: BatteryDetailView): ToolResult {
  const weakest = [...detail.dimensions].sort((a, b) => a.score - b.score).slice(0, 2);

  const bullets: string[] = [];
  if (detail.detectedSignals.length > 0) {
    bullets.push(`Detected signals: ${detail.detectedSignals.join(", ").toLowerCase()}.`);
  } else {
    bullets.push("No anomaly signals are being reported against this pack's baseline.");
  }
  bullets.push(
    `Anomaly score is ${Math.round(detail.anomalyScore)} (${detail.anomalySeverity.toLowerCase()}) while health is ${detail.healthScore}/100 (${detail.healthClassification.toLowerCase().replace(/_/g, " ")}) — condition and trend are scored separately, so a healthy pack can still trend abnormally.`,
  );
  if (weakest.length > 0) {
    bullets.push(`Weakest dimensions: ${weakest.map((d) => `${d.label} ${d.score}/100`).join(", ")}.`);
  }
  bullets.push(`Likely issue: ${detail.likelyIssue}.`);
  bullets.push(`Business impact ${detail.businessImpact.toLowerCase()}; SLA ${detail.sla.toLowerCase()}.`);

  return {
    tool: "explain_risk",
    headline: `${detail.batteryId} carries ${Math.round(detail.riskScore)}% predictive risk (${detail.riskCategoryRaw.toLowerCase()}, ${detail.priority}).`,
    bullets,
    evidence: [
      { label: "Health", value: `${detail.healthScore}/100 (${detail.healthClassification})` },
      { label: "Anomaly", value: `${detail.anomalyScore} (${detail.anomalySeverity})` },
      { label: "Risk", value: `${detail.riskScore}% · ${detail.riskCategoryRaw} · ${detail.priority}` },
      { label: "Prediction window", value: detail.predictionWindow },
      { label: "Scored at", value: detail.scoredAt },
      { label: "Source", value: "Battery health & risk scoring", href: `/batteries/${detail.batteryId}` },
    ],
    links: [batteryLink(detail.batteryId)],
    caveat: detail.riskNote || RISK_LANGUAGE,
  };
}

/** "What are the top 5 critical stations?" */
export function toolTopStations(snap: FleetSnapshot, limit = 5): ToolResult {
  if (snap.stations.length === 0) {
    return {
      tool: "top_critical_stations",
      headline: "No station data is available from the service.",
      bullets: [],
      evidence: [{ label: "Source", value: "Station register" }],
      links: [],
    };
  }

  const ranked = [...snap.stations]
    .sort(
      (a, b) =>
        b.highRiskDocks - a.highRiskDocks ||
        b.criticalDocks - a.criticalDocks ||
        b.atRiskDocks - a.atRiskDocks ||
        a.avgHealthScore - b.avgHealthScore,
    )
    .slice(0, limit);

  const anyRisk = ranked.some((s) => s.highRiskDocks + s.criticalDocks + s.atRiskDocks > 0);

  return {
    tool: "top_critical_stations",
    headline: anyRisk
      ? `Stations ranked by dock risk — top ${ranked.length}.`
      : `No station is currently carrying dock-level risk; here ${ranked.length === 1 ? "is the only station" : `are the ${ranked.length} stations`} by average health.`,
    bullets: ranked.map(
      (s) =>
        `${s.stationId} — avg dock health ${s.avgHealthScore}/100, ${s.highRiskDocks} high-risk / ${s.atRiskDocks} at-risk / ${s.criticalDocks} critical of ${s.dockCount} docks, chargers ${s.chargersOnline} online / ${s.chargersOffline} offline${s.online ? "" : " (station offline)"}`,
    ),
    evidence: [
      { label: "Stations in fleet", value: `${snap.stations.length}` },
      { label: "Ranked by", value: "high-risk docks, then average health" },
      { label: "Source", value: "Station register", href: "/stations" },
    ],
    links: [
      { label: "Station list", href: "/stations" },
      ...ranked.slice(0, 3).map((s) => ({ label: s.stationId, href: `/stations/${s.stationId}` })),
    ],
    caveat: RISK_LANGUAGE,
  };
}

/** "What changed in <asset> over the last 7 days?" */
export function toolRecentChanges(target: BatteryDetailView | null): ToolResult {
  const bullets = [
    "Per-battery telemetry history is not available yet, so I cannot compare one day against another without inventing numbers.",
    "Daily telemetry does exist at dock level, if a per-dock trend would help in the meantime.",
  ];
  if (target) {
    bullets.unshift(
      `What I can tell you about ${target.batteryId} right now: risk ${Math.round(target.riskScore)}% (${target.riskCategoryRaw.toLowerCase()}), health ${target.healthScore}/100, anomaly ${Math.round(target.anomalyScore)}${
        target.detectedSignals.length ? `, with ${target.detectedSignals.join(", ").toLowerCase()}` : ""
      }.`,
    );
  }

  return {
    tool: "recent_changes",
    headline: target
      ? `I cannot show a 7-day history for ${target.batteryId} yet.`
      : "I cannot show a 7-day history for a battery yet.",
    bullets,
    evidence: [
      { label: "Unavailable", value: "per-battery telemetry history" },
      ...(target
        ? [{ label: "Scored at", value: target.scoredAt }] : []),
    ],
    links: target ? [batteryLink(target.batteryId)] : [],
    caveat: "I would rather say the data is unavailable than estimate a trend I cannot see.",
  };
}

/** "What should the field engineer check?" — the Recommend responsibility. */
export function toolEngineerChecks(detail: BatteryDetailView | null, snap: FleetSnapshot): ToolResult {
  if (!detail) {
    const queue = actionable(snap.batteries);
    if (queue.length === 0) {
      return {
        tool: "engineer_checks",
        headline: "There is nothing needing a field visit right now.",
        bullets: [`All ${snap.batteries.length} packs are in the Low risk band.`],
        evidence: [{ label: "Source", value: "Battery fleet register", href: "/batteries" }],
        links: [{ label: "Battery list", href: "/batteries" }],
        caveat: RISK_LANGUAGE,
      };
    }
    return {
      tool: "engineer_checks",
      headline: `Highest-priority pack is ${queue[0].batteryId} — ask me "what should the engineer check on ${queue[0].batteryId}?" for its checklist.`,
      bullets: queue.slice(0, 5).map(describeBattery),
      evidence: [{ label: "Source", value: "Battery fleet register", href: "/batteries" }],
      links: [batteryLink(queue[0].batteryId)],
      caveat: RISK_LANGUAGE,
    };
  }

  return {
    tool: "engineer_checks",
    headline: `For ${detail.batteryId} — ${detail.priority}, ${detail.sla.toLowerCase()}.`,
    bullets:
      detail.suggestedChecks.length > 0
        ? detail.suggestedChecks.map((check, idx) => `${idx + 1}. ${check}`)
        : ["The service returned no suggested checks for this pack."],
    evidence: [
      { label: "Likely issue", value: detail.likelyIssue },
      { label: "Priority / SLA", value: `${detail.priority} · ${detail.sla}` },
      { label: "Business impact", value: detail.businessImpact },
      { label: "Source", value: "Battery health & risk scoring", href: `/batteries/${detail.batteryId}` },
    ],
    links: [batteryLink(detail.batteryId)],
    caveat: `${detail.riskNote || RISK_LANGUAGE} Engineer assignment is out of scope for Phase 1.`,
  };
}

const TREND_KEYWORDS: Record<string, RegExp> = {
  charging: /charg/i,
  temperature: /temperat|thermal/i,
  current: /current|electrical/i,
  cell: /cell|imbalance|balance/i,
  capacity: /capacit|efficien|state of health|degradation/i,
  connectivity: /communicat|connect|offline|telemetry/i,
  swap: /swap|bms/i,
};

/** "Which assets are showing increasing charging time?" and the other signals. */
export function toolTrendSearch(snap: FleetSnapshot, trend: string, limit = 8): ToolResult {
  const pattern = TREND_KEYWORDS[trend] ?? new RegExp(trend, "i");

  // Fleet-level signal counts come straight from the service's own reason mix.
  const reasons = (snap.commandCenter?.top_failure_reasons ?? []).filter((r) => pattern.test(r.reason));
  const matches = snap.batteries.filter((b) => pattern.test(b.likelyIssue)).sort(byRiskDesc);
  const top = matches.slice(0, limit);

  if (reasons.length === 0 && top.length === 0) {
    return {
      tool: "trend_search",
      headline: `Nothing is currently flagged for that signal.`,
      bullets: [
        "No battery's likely issue matches it, and it is not among the fleet's reported failure reasons.",
      ],
      evidence: [{ label: "Source", value: "Operations summary and battery register" }],
      links: [{ label: "Battery list", href: "/batteries" }],
      caveat: RISK_LANGUAGE,
    };
  }

  const bullets: string[] = [];
  reasons.forEach((r) => {
    bullets.push(`Fleet-wide: "${r.reason}" affects ${r.count} assets (${r.percent}% of flagged signals).`);
  });
  if (top.length > 0) {
    bullets.push(
      ...top.map((b) => `${b.batteryId} — ${Math.round(b.riskScore)}% risk, ${b.likelyIssue}`),
    );
  } else {
    bullets.push(
      "No individual pack lists it as its dominant issue — it is a contributing signal rather than the leading one.",
    );
  }

  const plural = matches.length === 1 ? "battery lists" : "batteries list";
  return {
    tool: "trend_search",
    headline:
      reasons.length > 0
        ? `${reasons.map((r) => r.reason).join(", ")} — here is what the fleet reports.`
        : `That signal is not among the fleet's reported failure reasons, but ${matches.length} ${plural} a matching issue.`,
    bullets,
    evidence: [
      { label: "Matching packs", value: `${matches.length} of ${snap.batteries.length}` },
      { label: "Source", value: "Fleet failure signals and battery register", href: "/" },
    ],
    links: [{ label: "Battery list", href: "/batteries" }, ...top.slice(0, 3).map((b) => batteryLink(b.batteryId))],
    caveat: `This matches on each pack's dominant issue rather than every contributing signal. ${RISK_LANGUAGE}`,
  };
}

/** "Give me today's operational summary." — the Summarize responsibility. */
export function toolOperationalSummary(snap: FleetSnapshot): ToolResult {
  const cc = snap.commandCenter;
  if (!cc) {
    return {
      tool: "operational_summary",
      headline: "The command-center summary is not available from the service right now.",
      bullets: [],
      evidence: [{ label: "Source", value: "Operations summary" }],
      links: [],
    };
  }

  const b = cc.batteries;
  const reasons = cc.top_failure_reasons ?? [];

  return {
    tool: "operational_summary",
    headline: `Fleet health is ${b.overall_health_score}/100 (${b.overall_health_classification.toLowerCase()}) across ${b.total} batteries at ${cc.stations.total} station${cc.stations.total === 1 ? "" : "s"}.`,
    bullets: [
      `Availability: ${cc.stations.offline} station(s) offline, ${cc.chargers.faulty} charger(s) faulty of ${cc.chargers.total}, ${b.offline} batteries not reporting.`,
      `Condition: ${b.healthy} healthy, ${b.watch} watch, ${b.at_risk} at risk, ${b.critical} critical.`,
      `Predictive risk: ${b.high_risk_count} high-risk packs, ${b.predicted_failure_count} predicted failures.`,
      reasons.length
        ? `Leading signals: ${reasons.slice(0, 3).map((r) => `${r.reason} (${r.percent}%)`).join(", ")}.`
        : "No dominant failure signal reported.",
      `${cc.top_critical_alerts?.length ?? 0} critical alert(s) in the current feed.`,
    ],
    evidence: [
      { label: "Overall health", value: `${b.overall_health_score}/100` },
      { label: "High risk", value: `${b.high_risk_count}` },
      { label: "Predicted failures", value: `${b.predicted_failure_count}` },
      { label: "Source", value: "Operations summary", href: "/" },
    ],
    links: [
      { label: "Command Center", href: "/" },
      { label: "Battery list", href: "/batteries" },
    ],
    caveat: RISK_LANGUAGE,
  };
}

/** "Compare A and B." — the Compare responsibility. */
export function toolCompare(a: BatteryDetailView, b: BatteryDetailView): ToolResult {
  const row = (label: string, left: string, right: string) =>
    `${label}: ${a.batteryId} ${left} · ${b.batteryId} ${right}`;
  const riskier = a.riskScore >= b.riskScore ? a : b;

  return {
    tool: "compare_assets",
    headline: `${a.batteryId} vs ${b.batteryId} — ${riskier.batteryId} carries the higher predictive risk.`,
    bullets: [
      row("Risk", `${Math.round(a.riskScore)}% ${a.riskCategoryRaw}`, `${Math.round(b.riskScore)}% ${b.riskCategoryRaw}`),
      row("Health", `${a.healthScore}/100`, `${b.healthScore}/100`),
      row("Anomaly", `${Math.round(a.anomalyScore)} (${a.anomalySeverity})`, `${Math.round(b.anomalyScore)} (${b.anomalySeverity})`),
      row("Likely issue", a.likelyIssue, b.likelyIssue),
      row("Priority / SLA", `${a.priority} · ${a.sla}`, `${b.priority} · ${b.sla}`),
      row(
        "Signals",
        a.detectedSignals.length ? a.detectedSignals.join(", ") : "none",
        b.detectedSignals.length ? b.detectedSignals.join(", ") : "none",
      ),
    ],
    evidence: [
      { label: a.batteryId, value: `${Math.round(a.riskScore)}% · ${a.healthScore}/100`, href: `/batteries/${a.batteryId}` },
      { label: b.batteryId, value: `${Math.round(b.riskScore)}% · ${b.healthScore}/100`, href: `/batteries/${b.batteryId}` },
      { label: "Source", value: "Battery health & risk scoring" },
    ],
    links: [batteryLink(a.batteryId), batteryLink(b.batteryId)],
    caveat: RISK_LANGUAGE,
  };
}

/** "Which assets are deteriorating?" — the Identify responsibility. */
export function toolDeteriorating(snap: FleetSnapshot, limit = 8): ToolResult {
  // Anomaly score is the trend signal; health is the current condition. A pack
  // can be "healthy" and still be deteriorating, which is the point.
  const ranked = [...snap.batteries]
    .filter((b) => b.anomalyScore >= 40)
    .sort((a, b) => b.anomalyScore - a.anomalyScore)
    .slice(0, limit);

  if (ranked.length === 0) {
    return {
      tool: "deteriorating",
      headline: "No pack is showing a meaningful deterioration trend.",
      bullets: [`No battery has an anomaly score of 40 or above.`],
      evidence: [{ label: "Source", value: "Battery fleet register", href: "/batteries" }],
      links: [{ label: "Battery list", href: "/batteries" }],
      caveat: RISK_LANGUAGE,
    };
  }

  return {
    tool: "deteriorating",
    headline: `${ranked.length} packs are trending abnormally (anomaly score 40+).`,
    bullets: ranked.map(
      (b) =>
        `${b.batteryId} — anomaly ${Math.round(b.anomalyScore)} (${b.anomalySeverity.toLowerCase()}), health ${b.healthScore}/100, ${b.likelyIssue}`,
    ),
    evidence: [
      { label: "Criterion", value: "anomaly score ≥ 40" },
      {
        label: "Note",
        value: "anomaly tracks change, health tracks condition — a healthy pack can still be deteriorating",
      },
      { label: "Source", value: "Battery fleet register", href: "/batteries" },
    ],
    links: [{ label: "Battery list", href: "/batteries" }, ...ranked.slice(0, 3).map((b) => batteryLink(b.batteryId))],
    caveat: RISK_LANGUAGE,
  };
}

export async function loadBatteryDetail(batteryId: string): Promise<BatteryDetailView | null> {
  try {
    return normaliseBatteryDetail(await fetchBattery(batteryId));
  } catch {
    return null;
  }
}

export { riskCategory };
