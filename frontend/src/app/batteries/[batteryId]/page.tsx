import Link from "next/link";
import { ArrowLeft, Clock, Info, Sparkles } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { RiskPill } from "@/components/ui/RiskPill";
import { HealthBar, healthColor } from "@/components/ui/HealthBar";
import { CreateFieldActionButton } from "@/components/battery/CreateFieldActionButton";
import { getBatteryDetail } from "@/lib/api/resources";

const CLASSIFICATION_TONE: Record<string, string> = {
  HEALTHY: "var(--status-good)",
  WATCH: "var(--status-warning)",
  AT_RISK: "var(--status-serious)",
  CRITICAL: "var(--status-critical)",
};

function label(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function BatteryDetailPage({
  params,
}: {
  params: Promise<{ batteryId: string }>;
}) {
  const { batteryId } = await params;
  const { data: battery, error } = await getBatteryDetail(batteryId);

  if (error || !battery) {
    return (
      <PageShell title={batteryId} subtitle="Battery 360">
        <ApiErrorState title={`Could not load ${batteryId}`} error={error ?? "Unknown error"} />
      </PageShell>
    );
  }

  const scored = new Date(battery.scoredAt);
  const scoredLabel = Number.isNaN(scored.getTime())
    ? battery.scoredAt
    : scored.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  return (
    <PageShell title={battery.batteryId} subtitle="Battery 360">
      <div className="flex flex-col gap-4">
        <Link
          href="/batteries"
          className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-[var(--series-1)] hover:underline"
        >
          <ArrowLeft size={14} />
          All batteries
        </Link>

        <Panel>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-6">
            <div>
              <div className="text-[12px] text-text-muted">Condition</div>
              <div
                className="mt-1 text-[15px] font-semibold"
                style={{
                  color:
                    CLASSIFICATION_TONE[battery.healthClassification.toUpperCase()] ??
                    "var(--text-primary)",
                }}
              >
                {label(battery.healthClassification)}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-text-muted">Health Score</div>
              <div
                className="mt-1 text-[15px] font-semibold tabular-nums"
                style={{ color: healthColor(battery.healthScore) }}
              >
                {battery.healthScore}
                <span className="text-[12px] font-normal text-text-muted">/100</span>
              </div>
            </div>
            <div>
              <div className="text-[12px] text-text-muted">Anomaly</div>
              <div className="mt-1 text-[15px] font-semibold tabular-nums text-text-primary">
                {battery.anomalyScore}
                <span className="ml-1 text-[12px] font-normal text-text-muted">
                  {label(battery.anomalySeverity)}
                </span>
              </div>
            </div>
            <div>
              <div className="text-[12px] text-text-muted">Predictive Risk</div>
              <div className="mt-1">
                <RiskPill percent={battery.riskScore} category={battery.riskCategoryRaw} showCategory />
              </div>
            </div>
            <div>
              <div className="text-[12px] text-text-muted">Priority</div>
              <div className="mt-1 text-[15px] font-semibold tabular-nums text-text-primary">
                {battery.priority}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-text-muted">Prediction Window</div>
              <div className="mt-1 text-[13px] font-medium text-text-primary">
                {battery.predictionWindow}
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Health Dimensions">
            {battery.dimensions.length === 0 ? (
              <p className="text-[13px] text-text-muted">No dimension scores reported.</p>
            ) : (
              <ul className="space-y-3">
                {battery.dimensions.map((dimension) => (
                  <li key={dimension.key} className="flex items-center gap-3">
                    <span className="w-32 flex-none text-[13px] text-text-secondary">
                      {dimension.label}
                    </span>
                    <div className="flex-1">
                      <HealthBar score={dimension.score} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Detected Signals">
            {battery.detectedSignals.length === 0 ? (
              <p className="text-[13px] text-text-muted">
                No anomaly signals detected against this pack&apos;s baseline.
              </p>
            ) : (
              <ul className="space-y-2">
                {battery.detectedSignals.map((signal) => (
                  <li key={signal} className="flex items-start gap-2 text-[13px] text-text-secondary">
                    <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-[var(--status-warning)]" />
                    {signal}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="AI Insight" action={<Sparkles size={16} className="text-[var(--series-1)]" />}>
            <p className="text-[13px] font-medium leading-relaxed text-text-primary">
              {battery.likelyIssue}
            </p>
            <p className="mt-3 text-[12.5px] leading-relaxed text-text-secondary">{battery.riskNote}</p>
            <dl className="mt-4 space-y-1.5 border-t border-[var(--border-hairline)] pt-3 text-[12px]">
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Business impact</dt>
                <dd className="font-medium text-text-secondary">{battery.businessImpact}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">SLA</dt>
                <dd className="text-right font-medium text-text-secondary">{battery.sla}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Scored at</dt>
                <dd className="font-medium text-text-secondary">{scoredLabel}</dd>
              </div>
            </dl>
          </Panel>
        </div>

        <Panel title="Recommended Field Action">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[13px] text-text-secondary">
                <span className="font-semibold text-text-primary">{battery.priority}</span> ·{" "}
                {battery.sla} · {battery.likelyIssue}
              </p>
              {battery.suggestedChecks.length > 0 ? (
                <ol className="mt-3 ml-4 list-decimal space-y-1 text-[13px] text-text-secondary">
                  {battery.suggestedChecks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-[13px] text-text-muted">No checks suggested.</p>
              )}
            </div>
            <CreateFieldActionButton batteryId={battery.batteryId} sla={battery.sla} priority={battery.priority} />
          </div>
        </Panel>

        {/* Telemetry charts and the event feed need endpoints that do not exist
            yet (GET /batteries/{id}/telemetry and /events both 404), so the
            gap is stated rather than filled with placeholder data. */}
        <Panel>
          <div className="flex items-start gap-2.5 text-[13px] text-text-secondary">
            <Info size={16} className="mt-0.5 flex-none text-[var(--series-1)]" />
            <span>
              <span className="font-semibold text-text-primary">
                Telemetry charts and the event feed are not shown for this pack.
              </span>{" "}
              They need <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">GET /batteries/{"{id}"}/telemetry</code>{" "}
              and <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">GET /batteries/{"{id}"}/events</code>,
              which the service does not expose yet. The chart component is already written (src/components/battery/TelemetryChart.tsx) and needs only to be wired back in once the endpoint exists.
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[12px] text-text-muted">
            <Clock size={12} />
            Dock-level telemetry is available at <code className="mx-1">/assets/{"{dock_id}"}/telemetry</code> if a
            per-dock view would be useful in the meantime.
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}
