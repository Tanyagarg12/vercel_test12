import { Suspense } from "react";
import Link from "next/link";
import { LocationSelect, type LocationOption } from "./LocationSelect";
import { DateRangePicker } from "./DateRangePicker";
import { AlertBell } from "./AlertBell";
import { LastUpdated } from "@/components/dashboard/RefreshStrip";
import type { HeaderAlert } from "@/lib/api/resources";

export function Topbar({
  title,
  subtitle,
  alertCount,
  alerts = [],
  locations = [],
  dataAsOf = null,
}: {
  title: string;
  subtitle: string;
  alertCount: number;
  alerts?: HeaderAlert[];
  locations?: LocationOption[];
  dataAsOf?: string | null;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[var(--border-hairline)] bg-[var(--surface-1)] px-5 py-2">
      <div className="min-w-0">
        {/* The product name doubles as the way back to the dashboard. */}
        <Link href="/" className="inline-block rounded hover:opacity-80">
          <h1 className="text-[19px] font-semibold leading-tight text-text-primary">{title}</h1>
        </Link>
        <p className="text-[12px] leading-tight text-text-muted">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <LastUpdated />

        <LocationSelect locations={locations} />

        {/* useSearchParams needs a Suspense boundary during prerender. */}
        <Suspense
          fallback={
            <span className="rounded-xl border border-[var(--border-hairline)] px-3.5 py-2 text-[13px] text-text-muted">
              Loading dates…
            </span>
          }
        >
          <DateRangePicker dataAsOf={dataAsOf} />
        </Suspense>

        <AlertBell count={alertCount} alerts={alerts} />

        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--series-1)] text-[13px] font-semibold text-white">
            AU
          </span>
          <span className="text-[13px] leading-tight">
            <span className="block font-semibold text-text-primary">Admin User</span>
            <span className="block text-text-muted">Operations Head</span>
          </span>
        </div>
      </div>
    </header>
  );
}
