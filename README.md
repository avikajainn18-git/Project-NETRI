# NETRI

NETRI (Network for Emergency Threat Response and Intervention) is an end-to-end emergency communication prototype. A dedicated physical device produces an emergency event, a smartphone gateway relays it, the backend creates and manages the incident, and the organization’s consoles coordinate the response.

This repository contains all six Round-1 stages:

1. **Virtual hardware** — ESP32/Wokwi circuit, firmware, hold-to-trigger FSM, and LED indicators.
2. **Hardware simulator** — browser representation of the device and its physical interaction.
3. **Communication layer** — standalone simulated-BLE gateway between the simulator and backend.
4. **Backend and incident engine** — REST API, SQLite persistence, deduplication, assignment, escalation, and lifecycle actions.
5. **Frontends** — organization dashboard and live responder console.
6. **End-to-end integration** — simulator trigger → gateway → backend → real-time consoles → acknowledge/resolve or organization cancellation.

The Round-1 transport is intentionally labelled **simulated BLE**. The separation mirrors the intended physical architecture while Wokwi BLE passthrough is unavailable.

## Requirements

- Node.js **22.5 or newer** (Node 24 recommended; the backend uses the built-in `node:sqlite` module).
- npm 10 or newer.
- `g++` and `make` for firmware host tests.
- A Wokwi account and PlatformIO are only required to run the virtual ESP32 circuit.

## Install

From the repository root:

```bash
npm install
```

The root workspace installs the shared contracts, backend, gateway, dashboard, responder console, and device simulator.

## Run the complete demo

Open five terminals in the repository root and run:

```bash
# Terminal 1 — incident API, Socket.IO hub, and SQLite store
npm run dev:backend

# Terminal 2 — standalone smartphone gateway stand-in
npm run dev:gateway

# Terminal 3 — organization administration console
npm run dev:dashboard

# Terminal 4 — responder console
npm run dev:emergency

# Terminal 5 — physical device simulator
npm run dev:simulator
```

Open these URLs:

| Module | URL | Purpose |
|---|---|---|
| Organization dashboard | http://localhost:5173 | Device readiness, incident history, people, responders, contacts |
| Device simulator | http://localhost:5174 | Press and hold the physical SOS control for two seconds |
| Responder console | http://localhost:5175 | Live queue, acknowledge, and resolve incidents |
| Backend health | http://localhost:4000/health | API and persistence status |
| Gateway health | http://localhost:4001/health | Simulated-BLE relay status |

### Demo flow

1. Start the backend and gateway before opening the simulator.
2. In the simulator, press and hold the SOS control for at least two seconds. A short press is ignored.
3. Release the control. The emergency remains latched and the red alert LED stays on until the device is reset.
4. The simulator sends a validated event to the standalone gateway. The gateway forwards it to the backend.
5. The backend persists the incident in `data/netri.db`, deduplicates repeated events from the same device during the debounce window, and automatically assigns the oldest available responder.
6. The dashboard and responder console update over Socket.IO.
7. In the responder console, acknowledge the incident to stop escalation, then resolve it. Organization operators can cancel an open incident from the dashboard.

If the gateway or backend is offline, the simulator reports the unavailable simulated transport instead of showing a false delivery success.

## Build and verify

```bash
# Typecheck every TypeScript module and create production bundles
npm run build

# Typecheck without creating frontend bundles
npm run typecheck

# Run the firmware FSM, indicator, and boot-time identity tests
npm run test:firmware
```

The backend creates its local SQLite database at `data/netri.db` on first start. Override the location when needed:

```bash
NETRI_DB_PATH=/tmp/netri.db npm run dev:backend
```

On PowerShell:

```powershell
$env:NETRI_DB_PATH = "$pwd\data\netri.db"
npm run dev:backend
```

## Configuration

The browser modules accept optional Vite variables:

```bash
# dashboard and responder console
VITE_BACKEND_URL=http://localhost:4000

# device simulator
VITE_GATEWAY_URL=http://localhost:4001
```

The service ports can be changed with `PORT`:

- backend: `4000`
- gateway: `4001`
- dashboard: `5173`
- simulator: `5174`
- responder console: `5175`

## API surface

The backend exposes:

- `GET /health`, `/api/overview`, `/api/devices`, `/api/employees`, `/api/responders`, `/api/contacts`, `/api/incidents`
- `GET /api/incidents/:incidentId` with timeline and related records
- `POST /api/events/emergency` for the validated gateway event contract
- `POST /api/incidents/:id/acknowledge`
- `POST /api/incidents/:id/resolve`
- `POST /api/incidents/:id/cancel` for organization actors
- `PATCH /api/responders/:id/availability`

Socket.IO publishes `overview.updated`, `devices.updated`, `responders.updated`, `incidents.updated`, `incident.created`, `incident.updated`, and `incident.timeline`.

## Firmware / Wokwi

The approved Round-1 BOM is exactly one ESP32 DevKit V1, one tactile button, one green status LED, one red alert LED, and two 220 Ω resistors. The physical button is the only trigger. The firmware uses a two-second continuous hold threshold, latches the emergency after triggering, and clears only on restart in the current virtual-hardware stage.

Open `firmware/diagram.json` in Wokwi or use PlatformIO:

```bash
pio run -d firmware
```

Host-side firmware checks do not require an ESP32 toolchain:

```bash
npm run test:firmware
```

## Repository guide

- `contracts/` — shared Zod schemas and TypeScript types.
- `firmware/` — ESP32 sketch, approved Wokwi BOM, and host tests.
- `simulator/` — user-facing virtual NETRI device and simulated-BLE client.
- `gateway/` — standalone smartphone gateway process.
- `backend/` — SQLite incident engine, REST API, and Socket.IO hub.
- `dashboard/` — organization administration console.
- `emergency/` — responder operations console.
- `RULES.md` — authoritative product constraints and architecture decisions.

Authentication, external notification providers, battery simulation, GPS/GNSS, cellular fallback, accelerometer triggers, and AI/surveillance functionality are outside this prototype.
