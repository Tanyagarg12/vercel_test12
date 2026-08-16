import { Suspense } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { BatteriesTable } from "@/components/batteries/BatteriesTable";
import { getBatteriesPage } from "@/lib/api/resources";

export default async function BatteriesPage() {
  const { data, error } = await getBatteriesPage();

  const subtitle = data
    ? `${data.rows.length.toLocaleString()} packs${
        data.summary ? ` · overall health ${data.summary.overall_health_score}/100` : ""
      }`
    : "Live battery data";

  return (
    <PageShell title="Batteries" subtitle={subtitle}>
      {error || !data ? (
        <ApiErrorState title="Could not load the battery data" error={error ?? "Unknown error"} />
      ) : (
        <Panel>
          {/* BatteriesTable reads ?condition= from the dashboard donut, and
              useSearchParams needs a boundary during prerender. */}
          <Suspense fallback={<p className="py-6 text-[13px] text-text-muted">Loading batteries…</p>}>
            <BatteriesTable rows={data.rows} />
          </Suspense>
        </Panel>
      )}
    </PageShell>
  );
}
