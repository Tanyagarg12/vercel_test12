"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Bell, TriangleAlert } from "lucide-react";
import type { AlertTone } from "@/lib/api/normalise";
import type { HeaderAlert } from "@/lib/api/resources";

const TONE_STYLE: Record<AlertTone, { color: string; bg: string }> = {
  critical: { color: "var(--status-critical)", bg: "var(--status-critical-bg)" },
  serious: { color: "var(--status-serious)", bg: "var(--status-serious-bg)" },
  warning: { color: "var(--status-warning)", bg: "var(--status-warning-bg)" },
  neutral: { color: "var(--text-muted)", bg: "var(--surface-2)" },
};

const PREVIEW_COUNT = 3;

function timeLabel(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return timestamp;
  return parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function severityLabel(severity: string): string {
  const s = severity.replace(/[_-]+/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Bell with a preview of the three most recent alerts. Each row opens the
 * Alerts screen (or the specific battery when the alert names one), and a
 * footer link goes to the full feed.
 */
export function AlertBell({ count, alerts }: { count: number; alerts: HeaderAlert[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const preview = alerts.slice(0, PREVIEW_COUNT);

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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`${count} unread alerts`}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:bg-[var(--surface-2)]"
      >
        <Bell size={18} />
      </button>
      {count > 0 && (
        <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--status-critical)] px-1 text-[10px] font-bold text-white">
          {count}
        </span>
      )}

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[340px] overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-1)] shadow-xl shadow-black/10"
        >
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-4 py-2.5">
            <span className="text-[13px] font-semibold text-text-primary">Notifications</span>
            <span className="text-[11px] text-text-muted">{count} unread</span>
          </div>

          {preview.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12.5px] text-text-muted">No active alerts.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-hairline)]">
              {preview.map((alert) => {
                const style = TONE_STYLE[alert.tone];
                const Icon = alert.tone === "critical" ? TriangleAlert : AlertTriangle;
                return (
                  <li key={alert.key}>
                    <Link
                      href={alert.batteryId ? `/batteries/${alert.batteryId}` : "/alerts"}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-2.5 px-4 py-3 hover:bg-[var(--surface-2)]"
                    >
                      <span
                        className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full"
                        style={{ backgroundColor: style.bg }}
                      >
                        <Icon size={13} style={{ color: style.color }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold text-text-primary">
                          {alert.title}
                        </span>
                        <span className="block truncate text-[11.5px] text-text-muted">
                          {alert.entityLabel}
                          {alert.stationId ? ` · ${alert.stationId}` : ""}
                        </span>
                      </span>
                      <span className="flex-none text-right">
                        <span className="block text-[11px] text-text-muted">
                          {timeLabel(alert.timestamp)}
                        </span>
                        <span className="block text-[11px] font-semibold" style={{ color: style.color }}>
                          {severityLabel(alert.severity)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            href="/alerts"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 border-t border-[var(--border-hairline)] bg-[var(--surface-2)] px-4 py-2.5 text-[12.5px] font-semibold text-[var(--series-1)] hover:underline"
          >
            View all alerts
            <ArrowRight size={13} />
          </Link>
        </div>
      )}
    </div>
  );
}
