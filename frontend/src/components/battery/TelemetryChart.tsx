"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TelemetryPoint } from "@/lib/mock";

export function TelemetryChart({
  data,
  dataKey,
  color,
  unit,
  gradientId,
}: {
  data: TelemetryPoint[];
  dataKey: keyof TelemetryPoint;
  color: string;
  unit: string;
  gradientId: string;
}) {
  return (
    <div className="h-[168px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--gridline)" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(iso: string) =>
              new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            }
            interval={Math.max(1, Math.floor(data.length / 5))}
            axisLine={{ stroke: "var(--gridline)" }}
            tickLine={false}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={52}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            domain={["auto", "auto"]}
            // Recharts can pick ticks with long fractions (11.05, 9.35…) which
            // then clip against the axis width; one decimal keeps them legible.
            tickFormatter={(value: number) =>
              Number.isInteger(value) ? String(value) : value.toFixed(1)
            }
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-hairline)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--text-primary)",
            }}
            labelFormatter={(label) => new Date(String(label)).toLocaleString("en-IN")}
            formatter={(value) => [`${value} ${unit}`, ""]}
          />
          <Area
            type="monotone"
            dataKey={dataKey as string}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 2, stroke: "var(--surface-1)" }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
