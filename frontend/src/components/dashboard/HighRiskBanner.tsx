import Link from "next/link";
import { ArrowRight, BellRing } from "lucide-react";

export function HighRiskBanner({ count, windowHours }: { count: number; windowHours: number }) {
  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--status-critical)]/20 bg-[var(--status-critical-bg)] px-5 py-4">
      <div className="flex items-center gap-3">
        <BellRing size={22} className="flex-none text-[var(--status-critical)]" />
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-[15px] font-semibold text-text-primary">High Risk Prediction Alert</span>
          <span className="rounded-md bg-[var(--status-critical)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Critical
          </span>
          <span className="text-[13px] text-text-secondary">
            {count} asset{count === 1 ? "" : "s"} predicted to fail within the next {windowHours} hours.
            Immediate action is recommended.
          </span>
        </div>
      </div>
      <Link
        href="/ai-predictions"
        className="flex flex-none items-center gap-2 rounded-lg bg-[var(--series-1)] px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
      >
        View All High Risk Assets
        <ArrowRight size={15} />
      </Link>
    </div>
  );
}
