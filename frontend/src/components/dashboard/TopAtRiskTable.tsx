import Link from "next/link";
import { HealthBar } from "@/components/ui/HealthBar";
import { RiskPill } from "@/components/ui/RiskPill";
import type { AtRiskRow } from "@/lib/api/normalise";

/**
 * The Station column only renders when the service sends `station_id` on the
 * at-risk rows, and "Failure In" falls back to the prediction window when
 * `failure_in_hours` is absent — so the table degrades instead of showing
 * empty columns.
 *
 * Every cell is inside the row link, so the whole row is a click target rather
 * than just the ID.
 */
export function TopAtRiskTable({ rows }: { rows: AtRiskRow[] }) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-text-muted">No batteries currently at risk.</p>;
  }

  const showStation = rows.some((row) => row.stationId);
  const showHours = rows.some((row) => row.failureInHours !== null);

  return (
    <table className="w-full table-fixed text-left">
      <colgroup>
        <col className="w-[22%]" />
        {showStation && <col className="w-[20%]" />}
        <col className="w-[15%]" />
        <col className={showHours ? "w-[16%]" : "w-[27%]"} />
        <col className="w-[14%]" />
      </colgroup>
      <thead>
        <tr className="text-[10px] uppercase leading-tight tracking-wide text-text-muted">
          <th className="pb-1.5 pr-2 font-medium">Battery ID</th>
          {showStation && <th className="pb-1.5 pr-2 font-medium">Station</th>}
          <th className="pb-1.5 pr-2 font-medium">Risk</th>
          <th className="pb-1.5 pr-2 font-medium">{showHours ? "Failure In" : "Window"}</th>
          <th className="pb-1.5 font-medium">Health</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--border-hairline)]">
        {rows.map((row) => {
          const cell = "py-2 pr-2 text-[12px]";
          return (
            <tr key={row.batteryId} className="group cursor-pointer hover:bg-[var(--surface-2)]">
              <td className={cell}>
                <Link
                  href={`/batteries/${row.batteryId}`}
                  className="block whitespace-nowrap font-medium text-[var(--series-1)] after:absolute group-hover:underline"
                >
                  {row.batteryId}
                </Link>
              </td>
              {showStation && (
                <td className={`${cell} truncate text-text-secondary`}>
                  <Link href={`/batteries/${row.batteryId}`} className="block">
                    {row.stationId ?? "—"}
                  </Link>
                </td>
              )}
              <td className={cell}>
                <Link href={`/batteries/${row.batteryId}`} className="block">
                  <RiskPill percent={row.riskScore} category={row.riskCategory} />
                </Link>
              </td>
              <td className={`${cell} tabular-nums text-text-secondary`} title={row.likelyIssue}>
                <Link href={`/batteries/${row.batteryId}`} className="block">
                  {row.failureInHours !== null ? `${row.failureInHours} Hrs` : row.predictionWindow}
                </Link>
              </td>
              <td className="py-2">
                <Link href={`/batteries/${row.batteryId}`} className="block">
                  <HealthBar score={row.healthScore} compact />
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
