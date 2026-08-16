"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardPlus } from "lucide-react";

/**
 * Raises a field action locally. Wiring this to POST /operations/field-actions
 * is pending one answer: that endpoint takes an `asset_id` (a dock, e.g.
 * QIS-001-10), while this screen is a battery — so it is not yet clear which
 * identifier an action should be filed against.
 */
export function CreateFieldActionButton({
  batteryId,
  sla,
  priority,
}: {
  batteryId: string;
  sla: string;
  priority: string;
}) {
  const [action, setAction] = useState<{ id: string } | null>(null);

  if (action) {
    return (
      <div className="rounded-lg border border-[var(--status-good)]/25 bg-[var(--status-good-bg)] px-4 py-3 text-[13px]">
        <div className="flex items-center gap-2 font-semibold text-[var(--status-good)]">
          <CheckCircle2 size={15} />
          Field action {action.id} created
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-text-secondary">
          <div>
            <dt className="inline text-text-muted">Asset: </dt>
            <dd className="inline font-medium">{batteryId}</dd>
          </div>
          <div>
            <dt className="inline text-text-muted">Priority: </dt>
            <dd className="inline font-medium">{priority}</dd>
          </div>
          <div className="col-span-2">
            <dt className="inline text-text-muted">SLA: </dt>
            <dd className="inline font-medium">{sla}</dd>
          </div>
          <div className="col-span-2">
            <dt className="inline text-text-muted">Status: </dt>
            <dd className="inline font-medium">Unassigned (recorded locally)</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <button
      onClick={() => setAction({ id: `FA-${batteryId.replace(/\D/g, "").padStart(4, "0")}` })}
      className="flex flex-none items-center gap-2 rounded-lg bg-[var(--series-1)] px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
    >
      <ClipboardPlus size={15} />
      Create Field Action
    </button>
  );
}
