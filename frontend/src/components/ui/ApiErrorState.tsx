import { CloudOff } from "lucide-react";

/** Shown when a live-only screen cannot reach the service. It names the reason
 * rather than rendering an empty table that looks like "no data". */
export function ApiErrorState({ title, error }: { title: string; error: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-1)] px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--status-warning-bg)]">
        <CloudOff size={20} className="text-[var(--status-warning)]" />
      </span>
      <div>
        <p className="text-[14px] font-semibold text-text-primary">{title}</p>
        <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-text-muted">{error}</p>
      </div>
      <p className="text-[12px] text-text-muted">
        Set <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5">API_BASE_URL</code> in{" "}
        <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5">frontend/.env.local</code> and restart,
        or check that the service is reachable.
      </p>
    </div>
  );
}
