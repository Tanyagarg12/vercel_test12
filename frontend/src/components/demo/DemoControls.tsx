"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Syringe } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import type { ApiDemoInjectResult, ApiDemoResetResult } from "@/lib/api/types";

export interface DemoOption {
  code: string;
  label: string;
}

const SEVERITIES = ["LOW", "MEDIUM", "HIGH"];

function classificationColor(value: string): string {
  const v = value.toUpperCase();
  if (v.includes("CRITICAL")) return "var(--status-critical)";
  if (v.includes("AT_RISK") || v.includes("HIGH")) return "var(--status-serious)";
  if (v.includes("WATCH") || v.includes("WARN") || v.includes("MODERATE")) return "var(--status-warning)";
  return "var(--status-good)";
}

/**
 * Demo data control (spec section 14). Resets the environment to a known
 * dataset and injects a failure scenario into a chosen asset, so the
 * detect → score → explain → recommend story can be replayed on demand.
 *
 * Scenario injection targets **docks** (QIS-001-xx): the platform's
 * /demo/inject rejects battery IDs, and the four scenarios perturb
 * charger/dock metrics.
 */
export function DemoControls({
  datasets,
  scenarios,
  assets,
  currentDataset,
}: {
  datasets: DemoOption[];
  scenarios: DemoOption[];
  assets: { assetId: string; label: string }[];
  currentDataset: string | null;
}) {
  const router = useRouter();

  const [dataset, setDataset] = useState(currentDataset ?? datasets[0]?.code ?? "");
  const [assetId, setAssetId] = useState(assets[0]?.assetId ?? "");
  const [scenario, setScenario] = useState(scenarios[0]?.code ?? "");
  const [severity, setSeverity] = useState("HIGH");
  const [durationDays, setDurationDays] = useState(5);

  const [busy, setBusy] = useState<null | "reset" | "inject">(null);
  const [error, setError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<ApiDemoResetResult | null>(null);
  const [injectResult, setInjectResult] = useState<ApiDemoInjectResult | null>(null);

  async function send(action: "reset" | "inject") {
    setBusy(action);
    setError(null);
    setResetResult(null);
    setInjectResult(null);

    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          action === "reset"
            ? { action, dataset }
            : { action, assetId, scenario, severity, durationDays },
        ),
      });
      const payload = await response.json();

      if (!response.ok || payload.error) {
        setError(payload.error ?? `Request failed (HTTP ${response.status})`);
        return;
      }

      if (action === "reset") setResetResult(payload.result as ApiDemoResetResult);
      else setInjectResult(payload.result as ApiDemoInjectResult);

      // Server components hold the fetched data, so re-render them to pick up
      // the newly rescored fleet.
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setBusy(null);
    }
  }

  const selectClass =
    "w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] px-3 py-2 text-[13px] text-text-primary outline-none focus:border-[var(--series-1)]";
  const labelClass = "mb-1 block text-[12px] font-medium text-text-muted";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Reset Demo Environment">
        <p className="text-[13px] leading-relaxed text-text-secondary">
          Reloads the data from a baseline dataset and rescores every asset, so the demo starts from a
          known state every time.
        </p>

        <div className="mt-4">
          <label className={labelClass} htmlFor="demo-dataset">
            Dataset
          </label>
          <select
            id="demo-dataset"
            value={dataset}
            onChange={(event) => setDataset(event.target.value)}
            className={selectClass}
          >
            {datasets.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11.5px] text-text-muted">
            <code className="rounded bg-[var(--surface-2)] px-1">normal_operations</code> is an all-healthy
            dataset; <code className="rounded bg-[var(--surface-2)] px-1">degraded_fleet</code> contains
            at-risk assets and is the one worth demoing.
          </p>
        </div>

        <button
          onClick={() => send("reset")}
          disabled={busy !== null || !dataset}
          className="mt-4 flex items-center gap-2 rounded-lg bg-[var(--series-1)] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {busy === "reset" ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
          {busy === "reset" ? "Resetting…" : "Reset demo"}
        </button>

        {resetResult && (
          <div className="mt-4 rounded-lg border border-[var(--status-good)]/25 bg-[var(--status-good-bg)] p-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--status-good)]">
              <CheckCircle2 size={15} />
              Reset to {resetResult.dataset}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-text-secondary">
              <div>
                <dt className="inline text-text-muted">Assets: </dt>
                <dd className="inline font-medium">{resetResult.asset_count}</dd>
              </div>
              <div>
                <dt className="inline text-text-muted">Batteries: </dt>
                <dd className="inline font-medium">{resetResult.battery_count}</dd>
              </div>
              {resetResult.battery_risk_summary && (
                <div className="col-span-2">
                  <dt className="inline text-text-muted">Battery risk: </dt>
                  <dd className="inline font-medium">
                    {Object.entries(resetResult.battery_risk_summary)
                      .map(([k, v]) => `${v} ${k.toLowerCase()}`)
                      .join(" · ")}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </Panel>

      <Panel title="Inject Failure Scenario">
        <p className="text-[13px] leading-relaxed text-text-secondary">
          Perturbs an asset&apos;s telemetry and rescores it immediately — the dashboard reflects the new
          risk on the next load.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelClass} htmlFor="demo-asset">
              Asset (dock)
            </label>
            <select
              id="demo-asset"
              value={assetId}
              onChange={(event) => setAssetId(event.target.value)}
              className={selectClass}
            >
              {assets.map((asset) => (
                <option key={asset.assetId} value={asset.assetId}>
                  {asset.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className={labelClass} htmlFor="demo-scenario">
              Scenario
            </label>
            <select
              id="demo-scenario"
              value={scenario}
              onChange={(event) => setScenario(event.target.value)}
              className={selectClass}
            >
              {scenarios.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="demo-severity">
              Severity
            </label>
            <select
              id="demo-severity"
              value={severity}
              onChange={(event) => setSeverity(event.target.value)}
              className={selectClass}
            >
              {SEVERITIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="demo-duration">
              Duration (days)
            </label>
            <input
              id="demo-duration"
              type="number"
              min={1}
              max={30}
              value={durationDays}
              onChange={(event) => setDurationDays(Number(event.target.value))}
              className={selectClass}
            />
          </div>
        </div>

        <button
          onClick={() => send("inject")}
          disabled={busy !== null || !assetId || !scenario}
          className="mt-4 flex items-center gap-2 rounded-lg bg-[var(--status-serious)] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {busy === "inject" ? <Loader2 size={15} className="animate-spin" /> : <Syringe size={15} />}
          {busy === "inject" ? "Injecting…" : "Inject scenario"}
        </button>

        {injectResult && (
          <div className="mt-4 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)] p-3">
            <div className="text-[13px] font-semibold text-text-primary">
              {injectResult.scenario_label} injected into {injectResult.asset_id}
            </div>
            <dl className="mt-2 space-y-1 text-[12px]">
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Health</dt>
                <dd
                  className="font-semibold tabular-nums"
                  style={{ color: classificationColor(injectResult.health_classification) }}
                >
                  {injectResult.health_score}/100 · {injectResult.health_classification}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Anomaly</dt>
                <dd className="font-semibold tabular-nums text-text-secondary">
                  {injectResult.anomaly_score} · {injectResult.anomaly_severity}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Predictive risk</dt>
                <dd
                  className="font-semibold tabular-nums"
                  style={{ color: classificationColor(injectResult.risk_category) }}
                >
                  {injectResult.risk_score}% · {injectResult.risk_category} · {injectResult.priority}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Likely issue</dt>
                <dd className="text-right font-medium text-text-secondary">{injectResult.likely_issue}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Metrics perturbed</dt>
                <dd className="text-right font-medium text-text-secondary">
                  {injectResult.metrics_perturbed.join(", ")}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </Panel>

      {error && (
        <div className="lg:col-span-2">
          <div className="flex items-start gap-2.5 rounded-xl border border-[var(--status-critical)]/25 bg-[var(--status-critical-bg)] px-4 py-3">
            <AlertTriangle size={16} className="mt-0.5 flex-none text-[var(--status-critical)]" />
            <p className="text-[13px] text-text-secondary">
              <span className="font-semibold text-text-primary">Request failed. </span>
              {error}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
