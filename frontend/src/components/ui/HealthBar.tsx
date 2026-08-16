export function healthColor(score: number): string {
  if (score >= 70) return "var(--status-good)";
  if (score >= 40) return "var(--status-warning)";
  return "var(--status-critical)";
}

/** Score readout with an inline magnitude bar, as used in the at-risk tables.
 * `compact` drops the "/100" suffix for narrow table columns. */
export function HealthBar({ score, compact = false }: { score: number; compact?: boolean }) {
  const color = healthColor(score);
  return (
    <div className={compact ? "w-full min-w-[46px]" : "w-full min-w-[64px]"}>
      <div className="whitespace-nowrap text-[12px] font-semibold tabular-nums" style={{ color }}>
        {Math.round(score)}
        {!compact && <span className="font-normal text-text-muted">/100</span>}
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--surface-2)]">
        <div
          className="h-1.5 rounded-full"
          style={{ width: `${Math.max(2, Math.min(100, score))}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
