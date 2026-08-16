import Link from "next/link";
import { CITIES, type Station } from "@/lib/mock";

const LAT_RANGE: [number, number] = [7, 33];
const LNG_RANGE: [number, number] = [67, 92];

function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - LNG_RANGE[0]) / (LNG_RANGE[1] - LNG_RANGE[0])) * 100;
  const y = ((LAT_RANGE[1] - lat) / (LAT_RANGE[1] - LAT_RANGE[0])) * 100;
  return { x: Math.min(97, Math.max(3, x)), y: Math.min(96, Math.max(4, y)) };
}

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
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)]">
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <pattern id="mapGrid" width="6.25%" height="10%" patternUnits="userSpaceOnUse">
            <path d="M 0 0 L 0 1000 M 0 0 L 1000 0" stroke="var(--gridline)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mapGrid)" />
      </svg>

      {CITIES.map((city) => {
        const { x, y } = project(city.lat, city.lng);
        return (
          <span
            key={city.name}
            // Sits above the cluster so the markers don't cover the label.
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-[10px] font-semibold uppercase tracking-wide text-text-secondary"
            style={{ left: `${x}%`, top: `${Math.max(4, y - 7)}%` }}
          >
            {city.name}
          </span>
        );
      })}

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
              className="block h-2.5 w-2.5 rounded-full ring-2 ring-[var(--surface-1)] transition-transform hover:scale-[1.8]"
              style={{ backgroundColor: color }}
            />
          </Link>
        );
      })}
    </div>
  );
}
