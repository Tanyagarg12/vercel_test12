import { PageShell } from "@/components/layout/PageShell";
import { LiveMonitoringBody } from "@/components/legacy/LiveMonitoringBody";

export default function Page() {
  return (
    <PageShell title="Live Monitoring" subtitle="Simulated telemetry — the platform exposes no per-battery telemetry endpoint yet">
      <LiveMonitoringBody />
    </PageShell>
  );
}
