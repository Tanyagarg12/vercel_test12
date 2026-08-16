import { Plug, RadioTower, Thermometer, Warehouse } from "lucide-react";
import { rollUpToScenarios, type ScenarioCode } from "@/lib/api/scenarios";

/** One icon per scenario from section 6 of the requirements. */
const SCENARIO_STYLE: Record<ScenarioCode, { icon: typeof Plug; color: string }> = {
  cooling: { icon: Thermometer, color: "var(--status-critical)" },
  charging: { icon: Plug, color: "var(--status-warning)" },
  connectivity: { icon: RadioTower, color: "var(--series-1)" },
  station_performance: { icon: Warehouse, color: "var(--series-7)" },
};

/**
 * Shows the four Failure Scenario Engine scenarios rather than the platform's
 * raw signal names, so the panel speaks the language of the requirements. Each
 * row's tooltip lists the underlying signals it was rolled up from.
 */
export function FailureReasonsPanel({
  reasons,
}: {
  reasons: { reason: string; count: number; pct: number }[];
}) {
  const scenarios = rollUpToScenarios(reasons);
  const anySignal = scenarios.some((s) => s.count > 0);

  if (!anySignal) {
    return <p className="text-[13px] text-text-muted">No failure signals reported.</p>;
  }

  return (
    <ul className="-my-0.5 divide-y divide-[var(--border-hairline)]">
      {scenarios.map((scenario) => {
        const style = SCENARIO_STYLE[scenario.code];
        const Icon = style.icon;
        const muted = scenario.count === 0;
        return (
          <li
            key={scenario.code}
            className="flex items-center gap-2.5 py-2"
            title={
              scenario.signals.length > 0
                ? `${scenario.count} signals · ${scenario.signals.join(", ")}`
                : "No signals currently attributed to this scenario"
            }
          >
            <Icon
              size={18}
              style={{ color: muted ? "var(--text-muted)" : style.color }}
              className="flex-none"
            />
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate text-[13px] ${muted ? "text-text-muted" : "text-text-secondary"}`}
              >
                {scenario.label}
              </span>
              <span className="block text-[11px] text-text-muted">Scenario {scenario.section}</span>
            </span>
            <span
              className="flex-none text-[13px] font-semibold tabular-nums"
              style={{ color: muted ? "var(--text-muted)" : style.color }}
            >
              {Math.round(scenario.pct)}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}
