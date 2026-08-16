import { TrendingDown, TrendingUp } from "lucide-react";

/** Semicircular gauge. The coloured band shows where the score sits on the
 * critical -> healthy scale; the arc is drawn from the status palette so the
 * band meaning matches every other health colour on the dashboard. */
const BANDS = [
  { to: 40, color: "var(--status-critical)" },
  { to: 70, color: "var(--status-warning)" },
  { to: 100, color: "var(--status-good)" },
];

const RADIUS = 52;
const CENTER = 60;
const STROKE = 10;

function polar(value: number): { x: number; y: number } {
  // 0 -> 180deg (left), 100 -> 0deg (right)
  const angle = Math.PI * (1 - value / 100);
  return { x: CENTER + RADIUS * Math.cos(angle), y: CENTER - RADIUS * Math.sin(angle) };
}

function arcPath(from: number, to: number): string {
  const start = polar(from);
  const end = polar(to);
  const largeArc = to - from > 50 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function label(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 40) return "Needs Attention";
  return "Critical";
}

function labelColor(score: number): string {
  if (score >= 70) return "var(--status-good)";
  if (score >= 40) return "var(--status-warning)";
  return "var(--status-critical)";
}

export function OverallHealthGauge({ score, deltaPct }: { score: number; deltaPct: number }) {
  const rounded = Math.round(score);
  const marker = polar(Math.max(0, Math.min(100, score)));
  const improving = deltaPct >= 0;
  const DeltaIcon = improving ? TrendingUp : TrendingDown;

  return (
    <div className="flex flex-col rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-1)] p-5">
      <h3 className="text-[13px] font-medium text-text-secondary">Overall Health Score</h3>

      <div className="mt-1 flex flex-1 items-center gap-4">
        <div className="relative flex-none">
          <svg width="120" height="72" viewBox="0 0 120 72" role="img" aria-label={`Health score ${rounded} out of 100`}>
            <path
              d={arcPath(0, 100)}
              fill="none"
              stroke="var(--gridline)"
              strokeWidth={STROKE}
              strokeLinecap="round"
            />
            {BANDS.map((band, idx) => {
              const from = idx === 0 ? 0 : BANDS[idx - 1].to;
              const visibleTo = Math.min(band.to, Math.max(from, score));
              if (visibleTo <= from) return null;
              return (
                <path
                  key={band.to}
                  d={arcPath(from, visibleTo)}
                  fill="none"
                  stroke={band.color}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                />
              );
            })}
            <circle cx={marker.x} cy={marker.y} r={4.5} fill="var(--surface-1)" stroke={labelColor(score)} strokeWidth={3} />
          </svg>
          <div className="absolute inset-x-0 bottom-0 text-center">
            <div className="text-[26px] font-semibold leading-none tabular-nums text-text-primary">{rounded}</div>
            <div className="text-[11px] text-text-muted">/100</div>
          </div>
        </div>

        <div>
          <div className="text-[17px] font-semibold" style={{ color: labelColor(score) }}>
            {label(score)}
          </div>
          <div
            className="mt-0.5 flex items-center gap-1 text-[12px] font-medium"
            style={{ color: improving ? "var(--status-good)" : "var(--status-critical)" }}
          >
            <DeltaIcon size={13} />
            {Math.abs(deltaPct)}%
            <span className="font-normal text-text-muted">vs yesterday</span>
          </div>
        </div>
      </div>
    </div>
  );
}
