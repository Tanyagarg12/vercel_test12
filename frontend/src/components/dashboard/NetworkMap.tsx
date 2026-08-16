import Link from "next/link";
import { CITIES, type Station } from "@/lib/mock";
import {
  INDIA_COS_MID,
  INDIA_MAX_LAT,
  INDIA_MIN_LNG,
  INDIA_PATH,
  INDIA_SCALE,
  INDIA_VIEW_H,
  INDIA_VIEW_W,
} from "./indiaOutline";

/** Same projection the outline was generated with, expressed as a percentage
 * of the container, so HTML markers land exactly on the SVG boundary. */
function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - INDIA_MIN_LNG) * INDIA_COS_MID * INDIA_SCALE * 100) / INDIA_VIEW_W;
  const y = ((INDIA_MAX_LAT - lat) * INDIA_SCALE * 100) / INDIA_VIEW_H;
  return { x: Math.min(99, Math.max(1, x)), y: Math.min(99, Math.max(1, y)) };
}

/** Label placement per city, so neighbouring metros (Mumbai/Pune,
 * Bengaluru/Chennai) don't overlap each other or their marker clusters. */
const LABEL_SIDE: Record<string, "above" | "left" | "right"> = {
  Delhi: "above",
  Ahmedabad: "left",
  Kolkata: "right",
  Mumbai: "left",
  Pune: "right",
  Hyderabad: "right",
  Bengaluru: "left",
  Chennai: "right",
};

const LABEL_STYLE: Record<"above" | "left" | "right", React.CSSProperties> = {
  above: { transform: "translate(-50%, -100%)", marginTop: "-3.4%" },
  left: { transform: "translate(-100%, -50%)", marginLeft: "-3.6%" },
  right: { transform: "translate(0, -50%)", marginLeft: "3.6%" },
};

function markerColor(station: Station, atRisk: number): string {
  if (station.status === "OFFLINE") return "var(--text-muted)";
  if (atRisk >= 3) return "var(--status-critical)";
  if (atRisk >= 1) return "var(--status-warning)";
  return "var(--status-good)";
}

export const MAP_LEGEND = [
  { label: "Healthy", color: "var(--status-good)" },
  { label: "1-2 at-risk packs", color: "var(--status-warning)" },
  { label: "3+ at-risk packs", color: "var(--status-critical)" },
  { label: "Station offline", color: "var(--text-muted)" },
];

export function NetworkMap({
  stations,
  atRiskByStation,
}: {
  stations: Station[];
  atRiskByStation: Map<string, number>;
}) {
  return (
    <div
      className="relative mx-auto w-full max-w-[520px] overflow-hidden rounded-lg"
      style={{ aspectRatio: `${INDIA_VIEW_W} / ${INDIA_VIEW_H}` }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${INDIA_VIEW_W} ${INDIA_VIEW_H}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d={INDIA_PATH}
          fill="color-mix(in srgb, var(--series-1) 7%, var(--surface-2))"
          stroke="color-mix(in srgb, var(--series-1) 45%, var(--text-muted))"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>

      {stations.map((station) => {
        const { x, y } = project(station.lat, station.lng);
        const atRisk = atRiskByStation.get(station.stationId) ?? 0;
        const color = markerColor(station, atRisk);
        return (
          <Link
            key={station.stationId}
            href={`/stations/${station.stationId}`}
            title={`${station.stationId} · ${station.city} · ${station.status === "OFFLINE" ? "Offline" : `${atRisk} at-risk pack(s)`} · avg health ${station.healthScore}`}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <span
              className="block h-2 w-2 rounded-full ring-1 ring-white/80 transition-transform hover:scale-[2]"
              style={{ backgroundColor: color, boxShadow: "0 1px 2px rgba(0,0,0,0.25)" }}
            />
          </Link>
        );
      })}

      {/* Labels render above the marker clusters, with a halo so they stay
          legible over dense dots. */}
      {CITIES.map((city) => {
        const { x, y } = project(city.lat, city.lng);
        const side = LABEL_SIDE[city.name] ?? "above";
        return (
          <span
            key={city.name}
            className="pointer-events-none absolute z-10 whitespace-nowrap text-[9.5px] font-semibold uppercase tracking-wide text-text-primary"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              textShadow:
                "0 0 3px var(--surface-1), 0 0 3px var(--surface-1), 0 0 6px var(--surface-1)",
              ...LABEL_STYLE[side],
            }}
          >
            {city.name}
          </span>
        );
      })}
    </div>
  );
}
