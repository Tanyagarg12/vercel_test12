"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Info, Loader2 } from "lucide-react";

const PRESETS = [
  { days: 7, label: "Last 7 days" },
  { days: 14, label: "Last 14 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
];

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

/** Monday-first grid for the given month, padded to whole weeks. */
function monthGrid(month: Date): (Date | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= total; day++) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * Date control for the header.
 *
 * The platform exposes history as a rolling window (a `days` count) rather than
 * arbitrary date ranges, so picking a date sets the window from that date up to
 * the latest data. The choice is written to the `?days=` query parameter, which
 * the dashboard reads when it requests the trend series.
 */
export function DateRangePicker({ dataAsOf }: { dataAsOf: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentDays = Number(searchParams.get("days")) || 7;
  const latest = useMemo(() => {
    const parsed = dataAsOf ? new Date(dataAsOf) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? startOfDay(parsed) : startOfDay(new Date());
  }, [dataAsOf]);

  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date(latest.getFullYear(), latest.getMonth(), 1));
  // Changing the range re-renders on the server, which waits on the platform
  // API — without a pending state the control looks unresponsive for seconds.
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const from = useMemo(() => {
    const d = new Date(latest);
    d.setDate(d.getDate() - (currentDays - 1));
    return d;
  }, [latest, currentDays]);

  function apply(days: number) {
    const clamped = Math.min(365, Math.max(1, days));
    const params = new URLSearchParams(searchParams.toString());
    if (clamped === 7) params.delete("days");
    else params.set("days", String(clamped));
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
    setOpen(false);
  }

  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const cells = monthGrid(month);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] px-3.5 py-2 text-[13px] text-text-secondary hover:bg-[var(--surface-2)] disabled:opacity-70"
        disabled={pending}
      >
        {pending ? (
          <Loader2 size={15} className="animate-spin text-text-muted" />
        ) : (
          <CalendarDays size={15} className="text-text-muted" />
        )}
        {pending ? "Updating…" : `${fmt(from)} – ${fmt(latest)}`}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Select date range"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[292px] rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-1)] p-3 shadow-xl shadow-black/10"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              aria-label="Previous month"
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-[var(--surface-2)]"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-[13px] font-semibold text-text-primary">
              {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <button
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              aria-label="Next month"
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-[var(--surface-2)]"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((day) => (
              <span key={day} className="py-1 text-[10px] font-medium uppercase text-text-muted">
                {day}
              </span>
            ))}
            {cells.map((date, idx) => {
              if (!date) return <span key={`pad${idx}`} />;
              const future = date > latest;
              const inRange = date >= from && date <= latest;
              const isEnd = sameDay(date, latest);
              return (
                <button
                  key={date.toISOString()}
                  disabled={future}
                  onClick={() => apply(daysBetween(date, latest) + 1)}
                  className="rounded-md py-1.5 text-[12px] tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                  style={{
                    backgroundColor: isEnd
                      ? "var(--series-1)"
                      : inRange
                        ? "color-mix(in srgb, var(--series-1) 14%, transparent)"
                        : "transparent",
                    color: isEnd ? "#fff" : inRange ? "var(--series-1)" : "var(--text-secondary)",
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--border-hairline)] pt-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.days}
                onClick={() => apply(preset.days)}
                className="rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors"
                style={{
                  backgroundColor:
                    currentDays === preset.days ? "var(--series-1)" : "var(--surface-2)",
                  color: currentDays === preset.days ? "#fff" : "var(--text-secondary)",
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <p className="mt-3 flex gap-1.5 border-t border-[var(--border-hairline)] pt-2.5 text-[11px] leading-relaxed text-text-muted">
            <Info size={12} className="mt-0.5 flex-none" />
            <span>
              History is served as a rolling window, so this sets how far back the trend looks. Current
              health, risk and alerts always reflect the latest scoring run
              {dataAsOf ? ` (${latest.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})` : ""}.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
