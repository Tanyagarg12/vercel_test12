import { PageShell } from "@/components/layout/PageShell";
import { AlertsBody } from "@/components/legacy/AlertsBody";

export default function Page() {
  return (
    <PageShell title="Alerts" subtitle="Alert feed (synthetic data — /operations/alerts wiring pending)">
      <AlertsBody />
    </PageShell>
  );
}
