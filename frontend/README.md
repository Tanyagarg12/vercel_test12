# Predictive Remote Monitoring — Operations Dashboard

Phase 1 POC dashboard for the Circumcircle AI Asset Intelligence Platform.
Front-end only: the fleet and all of its scoring are generated in-process
from a seeded synthetic data layer, so there is no backend or database to
run.

## Running

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build && npm start   # production
```

## Screens

| Route | Screen |
|---|---|
| `/` | Operations Command Center — KPIs, health distribution, AI risk summary, alerts, 7-day trend, top at-risk batteries, failure reasons |
| `/live-monitoring` | Rolling telemetry stream over the watch list |
| `/stations`, `/stations/[id]` | Station list and station detail (its chargers + at-risk packs) |
| `/chargers` | Charger list with status and utilization |
| `/batteries`, `/batteries/[id]` | Battery list and **Battery 360** — telemetry charts, health dimensions, events, AI insight, recommended action |
| `/ai-predictions` | Predictive risk register, sortable by risk / impact / priority / location |
| `/alerts` | Alert feed with severity and acknowledgement state |
| `/maintenance` | Recommendation queue with field-action creation |
| `/map-view` | Simulated network map with risk hotspots |
| `/settings` | Scoring weights, classification bands, demo environment |

## Architecture

```
src/lib/mock/          the synthetic data layer + scoring engines
├── failureModes.ts    POC-02  five battery failure modes and their signals
├── engine.ts          POC-03..06  health, anomaly, predictive risk, recommendation
├── fleet.ts           POC-01  generates stations -> chargers -> batteries, then scores them
├── summary.ts         dashboard aggregations (KPIs, distribution, alerts, trend)
├── telemetry.ts       per-battery hourly series for the Battery 360 charts
└── rng.ts             seeded PRNG helpers

src/components/        layout shell, shared UI, dashboard panels, battery charts
src/app/               one directory per screen
```

Every screen reads from `src/lib/mock`. Replacing that one module with real
API calls is the only change needed to run the same UI against live
telemetry — the components never touch the generator directly.

### How the fleet is modelled

Two things degrade a battery, and they are deliberately kept separate:

- **wear** — gradual capacity fade. Lowers the **health score** (current
  condition) but is stable, so it does *not* raise predictive risk. A worn
  but steady pack needs replacement planning, not a callout.
- **active fault** — an in-progress degradation ramp. Produces the anomaly
  signals that drive **predictive risk** and a recommended field action.

That separation is why ~20% of the fleet sits below the healthy band while
only ~2% carries real predicted-failure risk — which is how a real fleet
behaves, and what the reference design shows.

Health is scored across five weighted dimensions (temperature 25%, charging
25%, electrical 20%, connectivity 10%, operational 20%). Anomaly signals are
combined with a noisy-OR rather than a sum, so several moderate signals
together read as clearly abnormal without one runaway metric pinning the
score at 100 — this is the "no single parameter crossed a threshold" case
the requirements call for.

Risk is always presented as **Predictive Risk / Early Warning**, never as a
confirmed failure prediction.

### Determinism

The generator is seeded (`DEMO_SEED` in `fleet.ts`), and equipment
availability is assigned by exact count rather than per-item probability, so
the fleet is identical on every load:

- 248 stations — 226 online, 22 offline
- 1,456 chargers — 1,312 online, 144 faulty
- 12,320 batteries — ~79% healthy, ~16% at risk, ~5% critical, 1,080 offline

`BAT-10234` at `ST-0456 Delhi` is pinned as the demo's hero scenario: a
thermal degradation ramp mid-flight, so the detect → score → explain →
recommend story reproduces on every run.

## Notes

- Charts use Recharts. Its `<Legend>` sorts entries by data key, so the
  trend chart renders its legend as markup to keep healthy → warning →
  critical order.
- Colours come from CSS custom properties in `globals.css` (a validated
  categorical palette plus a reserved status palette), and both light and
  dark themes are defined.
