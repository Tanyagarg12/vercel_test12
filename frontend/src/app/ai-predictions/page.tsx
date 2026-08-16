import { PageShell } from "@/components/layout/PageShell";
import { AiPredictionsBody } from "@/components/legacy/AiPredictionsBody";

export default function Page() {
  return (
    <PageShell title="AI Predictions" subtitle="Predictive risk register">
      <AiPredictionsBody />
    </PageShell>
  );
}
