import { PageShell } from "@/components/layout/PageShell";
import { LiveMonitoringBody } from "@/components/legacy/LiveMonitoringBody";

export default function Page() {
  return (
    <PageShell title="Live Monitoring" subtitle="Rolling telemetry stream across the fleet">
      <LiveMonitoringBody />
    </PageShell>
  );
}
