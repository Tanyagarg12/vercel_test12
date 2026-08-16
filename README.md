# Asset Intelligence Platform — Operations Dashboard

Phase 1 POC dashboard for battery-swap station operations. It reads live
scoring from the platform API and presents the operations-intelligence loop:

```
Telemetry → Anomaly Detection → Health Score → Predictive Risk
          → AI Explanation → Recommended Field Action → Dashboard
```

It answers the five questions from the requirements document: what is
happening, what is abnormal, what is likely to happen, why the AI thinks so,
and what the field team should do.

---

## Quick start

**Requirements:** Node.js 20.9+ (tested on 22.17) and npm.

```bash
cd frontend
cp .env.example .env.local     # then set API_BASE_URL
npm install
npm run dev
```

Open **http://localhost:3000**.

Without `API_BASE_URL` the app still runs, but falls back to a bundled sample
dataset and shows a "Showing sample data" warning at the top of the dashboard.

### Commands

Run these from `frontend/`.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload on port 3000 |
| `npm run build` | Production build (type-checks every route) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check only |

If a stale dev server is holding the port, stop it **before** deleting `.next`
— removing the build directory from under a running server corrupts its cache.

### Before pushing

Three commands, run from `frontend/`. `npm run build` is the one that matters —
it type-checks every route, so it catches what the other two miss:

```bash
npx tsc --noEmit    # types
npm run lint        # lint
npm run build       # 14 routes, full type-check
```

All three are expected to pass with no output beyond the build's route table.

---

## Screens

| Route | Screen | Data |
|---|---|---|
| `/` | **Command Center** — KPI cards with per-asset risk lists, top risk assets across all types, health distribution, AI risk summary, critical alerts, health trend, failure scenarios | Live |
| `/batteries` · `/batteries/[id]` | Battery register and **Battery 360** — health dimensions, detected signals, AI insight, recommended checks | Live |
| `/stations` · `/stations/[id]` | Station register and per-station chargers | Live |
| `/chargers` | Charger register with fault and last-seen state | Live |
| `/settings` | Scoring reference and demo data controls | Live |
| `/alerts` | Alert feed | Sample |
| `/ai-predictions` | Predictive risk register | Sample |
| `/live-monitoring` | Rolling telemetry stream | Sample |
| `/map-view` | Network map | Sample |

Plus the **AI Operations Copilot** — the robot icon at the bottom-right of
every screen.

The four "Sample" screens are waiting on API capabilities, not on work here:
per-battery telemetry (`/batteries/{id}/telemetry` returns 404), station
coordinates, and a decision on whether the risk register should be scoped to
docks or batteries.

---

## Deploying to Vercel

The Next.js app lives in `frontend/`, not at the repository root — this is the
one setting that catches people out.

**1. Import the repo** at [vercel.com/new](https://vercel.com/new).

**2. Set the Root Directory to `frontend`.** Vercel then detects Next.js and
fills in the build command itself. Skip this and the build fails with
"No Next.js version detected".

**3. Add the environment variable** — Project → Settings → Environment
Variables:

| Name | Value | Environments |
|---|---|---|
| `API_BASE_URL` | your platform API base URL | Production, Preview, Development |

It is deliberately **not** prefixed with `NEXT_PUBLIC_`, so the address stays
server-side and never ships to the browser.

**4. Deploy.** Every push to the connected branch redeploys automatically.

### After deploying

- Confirm the **"Showing sample data"** warning is absent. If it appears, the
  environment variable is missing or the API is unreachable — the dashboard
  will not silently pass simulated figures off as real.
- The upstream API cold-starts and can take 10–20s on its first request.
  Responses are cached 30s and served stale-while-revalidate, so only the first
  visit after an idle period is slow.

### From the CLI instead

```bash
cd frontend
npx vercel        # first run links the project and asks for the root directory
npx vercel --prod
```

---

## Architecture

```
frontend/src/
├── app/                  one directory per screen
├── components/           layout shell, shared UI, dashboard panels, charts
└── lib/
    ├── api/              the API boundary — types, client, normalisers
    ├── copilot/          POC-08 tool layer and intent router
    └── mock/             synthetic dataset used only as a fallback
```

### The API layer

| File | Role |
|---|---|
| `api/endpoints.ts` | Every API path in one place; nothing else builds URLs |
| `api/client.ts` | Fetch wrapper — timeouts, tagged caching, error typing |
| `api/types.ts` | Wire types, matching the service's snake_case exactly |
| `api/normalise.ts` | Wire types → the view models screens consume |
| `api/resources.ts` | Per-screen loaders |
| `api/scenarios.ts` | Rolls raw failure signals into the four spec scenarios |

Screens never call `fetch` directly. Responses are cached for 30 seconds and
tagged, so a dashboard load that touches five slow endpoints stays fast; demo
mutations expire the tag immediately so you always see your own writes.

### Health vs. risk

The two are scored separately, and conflating them is the easiest mistake to
make here:

- **Health** is current condition. A worn pack scores low but may be stable —
  that needs replacement planning, not a callout.
- **Risk** is an active trend. A pack can be classified healthy and still carry
  high predictive risk because its behaviour is diverging.

Risk is always presented as **Predictive Risk / Early Warning**, never as a
confirmed failure prediction.

### AI Operations Copilot (POC-08)

Spec section 12.1 requires that the language layer never calculates risk:

```
User → Copilot → Tool/API layer → Operational data → ML/Rules
     → Structured result → language layer → Explanation
```

| File | Role |
|---|---|
| `lib/copilot/apiTools.ts` | The tools. Each queries already-scored data; none re-derives risk. |
| `lib/copilot/router.ts` | Chooses which tool answers, and resolves asset identifiers. |
| `lib/copilot/serverAsk.ts` | Calls the platform's own `/copilot/ask` for prose when an LLM key is configured there. |
| `app/api/copilot/route.ts` | Server route, so the browser never sees the API URL. |

Every figure the copilot states comes from the same scoring the dashboard
reads, so the chat and the screens cannot disagree. Unknown assets and
off-topic questions are refused rather than answered.

---

## Documents

| File | What it is |
|---|---|
| `AI Asset Intelligence Platform — Phase 1 Requirements.docx` | The source requirements. Section 6 defines the four failure scenarios the dashboard groups by; section 12.1 defines the copilot architecture. |
| `SUN Mobility - Phase 1 Pitch Deck.docx` | Ten-slide walkthrough of Phase 1. Every figure in it is read from the live API or taken from the requirements — no projected business metrics. |

---

## The `backend/` directory

A FastAPI service written before the scope narrowed to a dashboard against the
hosted platform. **The dashboard does not use it and you do not need it.** It
is kept as a reference implementation of the same engines.

---

## Out of scope for Phase 1

Real operator-system integration, live IoT streaming, mobile apps, automated
engineer assignment, route and spare-parts optimization, remaining-useful-life
prediction, and production HA infrastructure. Engineer assignment is
deliberately stubbed — creating a field action records the issue, priority, SLA
and checklist for handover.
