import { riskCategory, type RiskCategory } from "@/lib/api/normalise";

const CATEGORY_STYLE: Record<RiskCategory, { color: string; bg: string }> = {
  CRITICAL: { color: "var(--status-critical)", bg: "var(--status-critical-bg)" },
  HIGH: { color: "var(--status-serious)", bg: "var(--status-serious-bg)" },
  MODERATE: { color: "var(--status-warning)", bg: "var(--status-warning-bg)" },
  LOW: { color: "var(--status-good)", bg: "var(--status-good-bg)" },
};

const LABEL: Record<RiskCategory, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MODERATE: "Moderate",
  LOW: "Low",
};

/** Accepts either the API's uppercase categories or the local title-case ones. */
export function RiskPill({
  percent,
  category,
  showCategory = false,
}: {
  percent: number;
  category: string;
  showCategory?: boolean;
}) {
  const normalised = riskCategory(category);
  const style = CATEGORY_STYLE[normalised];
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-semibold tabular-nums"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {Math.round(percent)}%
      {showCategory && <span className="font-medium">{LABEL[normalised]}</span>}
    </span>
  );
}
