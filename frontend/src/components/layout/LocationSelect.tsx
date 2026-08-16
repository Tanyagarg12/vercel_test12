"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, MapPin } from "lucide-react";

export interface LocationOption {
  stationId: string;
  label: string;
  online: boolean;
}

/**
 * Locations come from the live station list. The dashboard aggregates are
 * pre-computed server-side and take no location parameter, so picking a station
 * opens that station rather than pretending to filter the page.
 */
export function LocationSelect({ locations }: { locations: LocationOption[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
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

  const label = locations.length === 1 ? locations[0].label : "All Locations";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] px-3.5 py-2 text-[13px] text-text-secondary hover:bg-[var(--surface-2)]"
      >
        <MapPin size={15} className="text-text-muted" />
        {label}
        <ChevronDown size={14} className="text-text-muted" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-[calc(100%+6px)] z-50 max-h-[320px] w-[248px] overflow-y-auto rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-1)] p-1.5 shadow-xl shadow-black/10"
        >
          <button
            onClick={() => {
              setOpen(false);
              router.push("/");
            }}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-text-secondary hover:bg-[var(--surface-2)]"
          >
            All Locations
            <Check size={14} className="text-[var(--series-1)]" />
          </button>

          {locations.length > 0 && (
            <div className="my-1 border-t border-[var(--border-hairline)]" />
          )}

          {locations.map((location) => (
            <button
              key={location.stationId}
              onClick={() => {
                setOpen(false);
                router.push(`/stations/${location.stationId}`);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-text-secondary hover:bg-[var(--surface-2)]"
            >
              <span className="truncate">{location.label}</span>
              <span
                className="h-2 w-2 flex-none rounded-full"
                style={{
                  backgroundColor: location.online ? "var(--status-good)" : "var(--text-muted)",
                }}
                title={location.online ? "Online" : "Offline"}
              />
            </button>
          ))}

          {locations.length === 0 && (
            <p className="px-2.5 py-2 text-[12px] text-text-muted">No stations reported.</p>
          )}
        </div>
      )}
    </div>
  );
}
