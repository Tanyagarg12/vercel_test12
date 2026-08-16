import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ChargersTable } from "@/components/chargers/ChargersTable";
import { getChargersPage } from "@/lib/api/resources";

export default async function ChargersPage() {
  const { data, error } = await getChargersPage();

  const subtitle = data
    ? `${data.length} chargers · ${data.filter((c) => c.online).length} online · ${data.filter((c) => c.faulty).length} faulty`
    : "Live charger inventory";

  return (
    <PageShell title="Chargers" subtitle={subtitle}>
      {error || !data ? (
        <ApiErrorState title="Could not load chargers" error={error ?? "Unknown error"} />
      ) : (
        <Panel>
          <ChargersTable rows={data} />
        </Panel>
      )}
    </PageShell>
  );
}
