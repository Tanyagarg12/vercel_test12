import Link from "next/link";
import { ArrowUpRight, Info } from "lucide-react";
import type { CopilotAnswer } from "@/lib/copilot/types";

/** Renders a structured tool result. The evidence block is the guardrail from
 * spec 12.3 — every important claim shows the data behind it. */
export function AnswerCard({ answer }: { answer: CopilotAnswer }) {
  return (
    <div className="space-y-2.5">
      {/* When the platform's own copilot has an LLM configured, its prose leads
          and the grounded figures below it act as the citation. */}
      {answer.platformAnswer && (
        <p className="rounded-lg bg-[var(--surface-1)] p-2.5 text-[13px] leading-relaxed text-text-primary">
          {answer.platformAnswer}
        </p>
      )}

      <p className="text-[13px] font-medium leading-snug text-text-primary">{answer.headline}</p>

      {answer.bullets.length > 0 && (
        <ul className="space-y-1.5">
          {answer.bullets.map((bullet, idx) => (
            <li key={idx} className="flex gap-2 text-[12.5px] leading-relaxed text-text-secondary">
              <span className="mt-[7px] h-1 w-1 flex-none rounded-full bg-[var(--series-1)]" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}

      {answer.evidence.length > 0 && (
        <div className="rounded-lg bg-[var(--surface-2)] p-2.5">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Source data
          </div>
          <dl className="space-y-1">
            {answer.evidence.map((item, idx) => (
              <div key={idx} className="flex items-baseline justify-between gap-3 text-[11.5px]">
                <dt className="flex-none text-text-muted">{item.label}</dt>
                <dd className="min-w-0 text-right font-medium text-text-secondary">
                  {item.href ? (
                    <Link href={item.href} className="text-[var(--series-1)] hover:underline">
                      {item.value}
                    </Link>
                  ) : (
                    item.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {answer.links.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {answer.links.map((link, idx) => (
            <Link
              key={idx}
              href={link.href}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border-hairline)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--series-1)] hover:bg-[var(--surface-2)]"
            >
              {link.label}
              <ArrowUpRight size={11} />
            </Link>
          ))}
        </div>
      )}

      {answer.caveat && (
        <p className="flex gap-1.5 text-[11px] leading-relaxed text-text-muted">
          <Info size={12} className="mt-0.5 flex-none" />
          <span>{answer.caveat}</span>
        </p>
      )}
    </div>
  );
}
