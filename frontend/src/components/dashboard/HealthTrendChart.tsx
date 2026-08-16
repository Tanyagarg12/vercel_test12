"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/api/normalise";

/** Bands match the health-score ranges the platform classifies against, so the
 * legend says what each line is actually measuring. */
const SERIES = [
  { key: "healthy", label: "Healthy", band: "70-100", color: "var(--status-good)" },
  { key: "warning", label: "Warning", band: "40-70", color: "var(--status-warning)" },
  { key: "critical", label: "Critical", band: "0-40", color: "var(--status-critical)" },
] as const;

export function HealthTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="flex h-full min-h-[210px] flex-col">
      {/* Rendered as markup rather than Recharts' <Legend>, which sorts its
          entries by data key and would break this order. */}
      <ul className="mb-1 flex flex-wrap justify-center gap-4">
        {SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-1.5 text-[11.5px] text-text-secondary">
            <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: series.color }} />
            {series.label}
            <span className="text-text-muted">({series.band})</span>
          </li>
        ))}
      </ul>

      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--gridline)" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={{ stroke: "var(--gridline)" }}
              tickLine={false}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              padding={{ left: 10, right: 10 }}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(value: number) => `${value}%`}
              axisLine={false}
              tickLine={false}
              width={46}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              label={{
                value: "% of Batteries",
                angle: -90,
                position: "insideLeft",
                style: { fill: "var(--text-muted)", fontSize: 11, textAnchor: "middle" },
              }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface-1)",
                border: "1px solid var(--border-hairline)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--text-primary)",
              }}
              formatter={(value, name) => [`${value}% of batteries`, String(name)]}
            />
            {SERIES.map((series) => (
              <Line
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.label}
                stroke={series.color}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: series.color }}
                activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--surface-1)" }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
