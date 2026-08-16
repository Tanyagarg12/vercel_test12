import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { StationsTable } from "@/components/stations/StationsTable";
import { getStationsPage } from "@/lib/api/resources";

export default async function StationsPage() {
  const { data, error } = await getStationsPage();

  const subtitle = data
    ? `${data.rows.length} station${data.rows.length === 1 ? "" : "s"}${
        data.summary ? ` · ${data.summary.online} online, ${data.summary.offline} offline` : ""
      }`
    : "Live station network";

  return (
    <PageShell title="Stations" subtitle={subtitle}>
      {error || !data ? (
        <ApiErrorState title="Could not load stations" error={error ?? "Unknown error"} />
      ) : (
        <Panel>
          <StationsTable rows={data.rows} />
        </Panel>
      )}
    </PageShell>
  );
}
