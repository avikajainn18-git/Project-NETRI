# NETRI | Network for Emergency Trigger Response and Intervention

**A dedicated emergency trigger. A coordinated response.**

NETRI is an end-to-end emergency communication prototype designed to connect a dedicated emergency device with an organization's response system. When a user activates the device, the event travels through a simulated smartphone gateway to the backend, where an incident is recorded, managed, and made available to the organization dashboard and responder console.

The project demonstrates the complete flow from physical-device interaction to coordinated incident response, using virtual hardware, a browser-based device simulator, a standalone gateway, a backend incident engine, and two operational interfaces.

> **Round 1 prototype:** The communication layer uses simulated Bluetooth Low Energy (BLE). The architecture separates the device, gateway, backend, and response interfaces so that the communication boundary can be developed independently of the physical hardware.

---

## Live Demo

The complete application is deployed on Render and can be accessed through a single portal.

| Component | Live URL |
|---|---|
| **NETRI Portal** | [project-netri.onrender.com](https://project-netri.onrender.com/) |
| Organization Dashboard | [Open Dashboard](https://project-netri.onrender.com/dashboard/) |
| Emergency Responder Console | [Open Responder Console](https://project-netri.onrender.com/emergency/) |
| Hardware Simulator | [Open Device Simulator](https://project-netri.onrender.com/simulator/) |
| Backend Health | [Check Backend](https://project-netri.onrender.com/health) |
| Gateway Health | [Check Gateway](https://project-netri-gateway.onrender.com/health) |

The portal provides navigation between the three application interfaces. The backend and gateway expose separate health endpoints for service verification.

**Important:** NETRI is a demonstration prototype, not a production emergency service. Do not rely on it to contact emergency services or to provide real-world emergency response.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Round 1 Implementation](#round-1-implementation)
- [Technology Stack](#technology-stack)
- [Requirements](#requirements)
- [Installation](#installation)
- [Running the Demo](#running-the-demo)
- [End-to-End Demonstration](#end-to-end-demonstration)
- [Build and Verification](#build-and-verification)
- [Configuration](#configuration)
- [Backend API](#backend-api)
- [Real-Time Events](#real-time-events)
- [Virtual Hardware and Firmware](#virtual-hardware-and-firmware)
- [Repository Structure](#repository-structure)
- [Deployment](#deployment)
- [Current Limitations](#current-limitations)

---

## Overview

NETRI is built around a simple objective: connect an emergency trigger to an organized response workflow.

The system separates the responsibilities of device interaction, communication, incident processing, and response coordination.

### Core capabilities

- **Dedicated trigger interaction:** A press-and-hold interaction prevents a short, accidental press from immediately generating an emergency event.
- **Device state management:** The device simulator reflects operational, arming, and latched emergency states.
- **Gateway-mediated communication:** A standalone gateway validates and relays emergency events to the backend.
- **Incident management:** The backend validates incoming events, persists incidents, deduplicates repeated events, assigns available responders, and manages incident state transitions.
- **Live response coordination:** The organization dashboard and responder console receive real-time updates through Socket.IO.
- **Responder workflow:** Responders can acknowledge and resolve assigned incidents, while organization operators can cancel open incidents.
- **System visibility:** Device readiness, incident history, responder availability, employee records, and emergency contacts are exposed through the application interfaces.

---

## Architecture

NETRI follows a modular architecture that separates the device, communication layer, incident engine, and user interfaces.

```text
┌─────────────────────────────┐
│ Virtual ESP32 Hardware      │
│ Button, firmware and LEDs   │
└─────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Browser Hardware Simulator  │
│ Device state and SOS input  │
└─────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Simulated BLE Gateway       │
│ Event validation and relay  │
└─────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Backend Incident Engine     │
│ REST API and SQLite         │
│ Deduplication and assignment│
│ Lifecycle and escalation    │
└─────────────────────────────┘
              │
              ├───────────────┐
              ▼               ▼
┌────────────────────┐  ┌────────────────────┐
│ Organization       │  │ Emergency Responder│
│ Dashboard          │  │ Console            │
└────────────────────┘  └────────────────────┘
              ▲               ▲
              └───────┬───────┘
                      │
                  Socket.IO
```

The ESP32 virtual hardware and browser simulator represent the device side of the architecture. In the browser demonstration, the simulator sends events directly to the standalone gateway through HTTP. The gateway forwards validated events to the backend.

The physical-hardware and browser-simulator paths are related prototype components, but they are not the same transport implementation. The browser simulation uses the `SIMULATED_BLE` transport label; it does not establish a real BLE connection to an ESP32.

---

## Round 1 Implementation

The project is organized into six implementation stages.

### 1. Virtual Hardware

An ESP32 DevKit V1 circuit models the emergency device, including its physical trigger, firmware state machine, and status indicators.

The firmware implements a continuous two-second hold threshold and latches the emergency state after activation.

### 2. Hardware Simulator

A browser-based representation of the NETRI device reproduces the physical interaction and visual state transitions.

It includes:
- Hold-to-trigger interaction
- Boot self-test and operational states
- Arming feedback
- Latched emergency state
- Device identity and status information
- Gateway connectivity status

### 3. Communication Layer

A standalone smartphone-gateway stand-in receives simulator events and relays them to the backend.

The gateway:
- Exposes a health endpoint
- Validates event payloads against the shared contract
- Forwards valid events to the backend
- Reports failures when the backend is unavailable

The transport is explicitly labelled simulated BLE.

### 4. Backend and Incident Engine

The backend provides the REST API, SQLite persistence, Socket.IO event distribution, and incident lifecycle operations.

It handles:
- Incoming emergency-event validation
- Incident creation and deduplication
- Automatic responder assignment
- Responder availability
- Incident acknowledgement and resolution
- Organization-controlled cancellation
- Time-based incident escalation
- Real-time state broadcasts

### 5. Frontend Applications

NETRI includes two operational interfaces:

**Organization Dashboard**
- Device and incident overview
- Employee and emergency-contact records
- Responder availability
- Incident history and details
- Incident cancellation for organization operators

**Emergency Responder Console**
- Live incident queue
- Incident severity and status
- Incident details and timeline
- Acknowledgement and resolution actions
- Responder availability controls

### 6. End-to-End Integration

The integrated workflow connects the simulator, gateway, backend, and both operational interfaces.

An emergency event creates an incident that is propagated to the dashboard and responder console. The responder can acknowledge the incident and resolve it; an organization operator can cancel an open incident.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| Shared contracts | TypeScript, Zod |
| Backend | Node.js, TypeScript, Express |
| Real-time communication | Socket.IO |
| Persistence | SQLite via `node:sqlite` |
| Gateway | Node.js, TypeScript, Express |
| Frontend applications | React, TypeScript, Vite |
| Virtual hardware | ESP32, PlatformIO, Wokwi |
| Firmware testing | C++, `g++`, `make` |
| Monorepo management | npm workspaces |
| Hosting | Render |

The shared contracts package keeps event schemas and application data types consistent across the gateway and backend.

---

## Requirements

Install the following tools before running the project locally:

- **Node.js 22.5 or newer.** Node.js 24 is recommended.
- **npm 10 or newer.**
- **`g++` and `make`** for the firmware host tests.
- **PlatformIO and a Wokwi account** only if you intend to build or run the virtual ESP32 circuit.

The backend uses Node.js's built-in `node:sqlite` module, so a compatible Node.js version is required.

---

## Installation

Clone the repository and enter its root directory:

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd Project-NETRI
```

Replace the placeholder with the repository's actual GitHub clone URL.

Install the workspace dependencies:

```bash
npm install
```

The root npm workspace manages the shared contracts, backend, gateway, dashboard, responder console, and device simulator.

---

## Running the Demo

NETRI supports two local workflows: running the complete application through the unified portal, or running the frontend development servers independently for faster UI development.

### Option A: Run the unified portal

First, build all workspace applications:

```bash
npm run build
```

Open two terminals in the repository root.

**Terminal 1: Backend**

```bash
npm run dev:backend
```

**Terminal 2: Gateway**

```bash
npm run dev:gateway
```

Open the portal:

[http://localhost:4000/](http://localhost:4000/)

The backend serves the portal and the production-built frontend applications from the same origin.

Available routes:

| Component | Local URL |
|---|---|
| NETRI Portal | `http://localhost:4000/` |
| Organization Dashboard | `http://localhost:4000/dashboard/` |
| Responder Console | `http://localhost:4000/emergency/` |
| Device Simulator | `http://localhost:4000/simulator/` |
| Backend Health | `http://localhost:4000/health` |
| Gateway Health | `http://localhost:4001/health` |

This workflow is best for testing the unified portal and its navigation.

### Option B: Run the frontend development servers

For live frontend development, start the backend, gateway, and three Vite development servers in five terminals.

**Terminal 1: Backend**

```bash
npm run dev:backend
```

**Terminal 2: Gateway**

```bash
npm run dev:gateway
```

**Terminal 3: Organization Dashboard**

```bash
npm run dev:dashboard
```

**Terminal 4: Emergency Responder Console**

```bash
npm run dev:emergency
```

**Terminal 5: Device Simulator**

```bash
npm run dev:simulator
```

Open the applications directly:

| Component | Local URL |
|---|---|
| Organization Dashboard | [http://localhost:5173](http://localhost:5173) |
| Device Simulator | [http://localhost:5174](http://localhost:5174) |
| Responder Console | [http://localhost:5175](http://localhost:5175) |
| Backend Health | [http://localhost:4000/health](http://localhost:4000/health) |
| Gateway Health | [http://localhost:4001/health](http://localhost:4001/health) |

Keep the backend and gateway running while testing the emergency flow.

---

## End-to-End Demonstration

Use the following sequence to demonstrate the integrated system.

1. **Start the services.** Ensure the backend and gateway are running and their health endpoints respond successfully.
2. **Open the device simulator.** Locate the simulated NETRI emergency control.
3. **Trigger an emergency.** Press and hold the control continuously for at least two seconds. A short press should not trigger an emergency.
4. **Release the control.** After a successful trigger, the emergency remains latched and the red alert indicator remains active until the simulator is reset.
5. **Verify event delivery.** The simulator sends an emergency event to the gateway, which relays it to the backend.
6. **Inspect the incident.** The backend creates or deduplicates the incident and updates the connected applications.
7. **Coordinate the response.** The dashboard and responder console update through Socket.IO.
8. **Acknowledge the incident.** The assigned responder acknowledges the incident, stopping the applicable acknowledgement escalation.
9. **Resolve or cancel the incident.** The responder can resolve an acknowledged incident. An organization operator can cancel an open incident.

If the gateway or backend is unavailable, the simulator should report the transport as unavailable rather than falsely reporting successful delivery.

Repeated triggers from the same device may be deduplicated within the configured debounce window. A repeated event does not necessarily create a new incident.

---

## Build and Verification

Run the full production build from the repository root:

```bash
npm run build
```

Run TypeScript checks without producing the frontend production bundles:

```bash
npm run typecheck
```

Run the host-side firmware tests:

```bash
npm run test:firmware
```

These checks cover different parts of the system: TypeScript compilation, workspace builds, and firmware state-machine and indicator logic.

For end-to-end verification, also test the live SOS workflow. A successful build alone does not verify gateway connectivity or real-time incident delivery.

---

## Configuration

### Frontend environment variables

The browser applications accept optional Vite variables.

**Organization Dashboard and Responder Console**

```bash
VITE_BACKEND_URL=http://localhost:4000
```

**Device Simulator**

```bash
VITE_GATEWAY_URL=http://localhost:4001
```

Vite environment variables are embedded during the frontend build. If a production URL changes, update the environment variable and rebuild the relevant frontend before redeploying.

### Gateway environment variables

```bash
NETRI_BACKEND_URL=http://localhost:4000
```

The gateway uses this value to forward emergency events to the backend.

### Service ports

| Service | Default Port |
|---|---:|
| Backend | `4000` |
| Gateway | `4001` |
| Organization Dashboard | `5173` |
| Device Simulator | `5174` |
| Responder Console | `5175` |

The backend and gateway use the `PORT` environment variable when supplied by the hosting environment.

### SQLite database

The backend creates its local SQLite database at:

```text
data/netri.db
```

To override the database location on macOS or Linux:

```bash
NETRI_DB_PATH=/tmp/netri.db npm run dev:backend
```

On Windows PowerShell:

```powershell
$env:NETRI_DB_PATH = "$pwd\data\netri.db"
npm run dev:backend
```

For hosted deployments, verify that the database location is on persistent storage if data must survive service restarts or redeployments.

---

## Backend API

The backend exposes the following HTTP API surface.

### Health and overview

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Backend health |
| `GET` | `/api/overview` | Summary metrics |
| `GET` | `/api/devices` | Device records |
| `GET` | `/api/employees` | Employee records |
| `GET` | `/api/contacts` | Emergency contacts |
| `GET` | `/api/responders` | Responder records |
| `GET` | `/api/incidents` | Incident list |
| `GET` | `/api/incidents/:incidentId` | Incident details and timeline |

### Emergency and incident lifecycle

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/events/emergency` | Submit a validated emergency event |
| `POST` | `/api/incidents/:incidentId/acknowledge` | Acknowledge an incident |
| `POST` | `/api/incidents/:incidentId/resolve` | Resolve an acknowledged incident |
| `POST` | `/api/incidents/:incidentId/cancel` | Cancel an open incident through the organization workflow |
| `PATCH` | `/api/responders/:responderId/availability` | Update responder availability |

Request payloads are validated against shared schemas from `@netri/contracts`. Invalid payloads and invalid lifecycle transitions are rejected.

The gateway submits validated device events to the backend through `POST /api/events/emergency`.

---

## Real-Time Events

The backend distributes state updates to connected clients through Socket.IO.

| Event | Purpose |
|---|---|
| `overview.updated` | Refresh dashboard overview |
| `devices.updated` | Refresh device state |
| `responders.updated` | Refresh responder state |
| `responder.updated` | Notify clients about a responder update |
| `incidents.updated` | Send the current incident list when a client connects |
| `incident.created` | Announce a newly created incident |
| `incident.updated` | Announce an incident lifecycle or escalation update |
| `incident.timeline` | Publish timeline entries for an incident |

The interfaces use these events to refresh live information without requiring a manual page reload.

---

## Virtual Hardware and Firmware

The approved Round 1 virtual-hardware bill of materials contains:

- One ESP32 DevKit V1
- One tactile push button
- One green status LED
- One red alert LED
- Two 220 Ω resistors

The physical button is the only trigger in this hardware stage.

The firmware implements a continuous two-second hold threshold, a latched emergency state, and LED indicators. In the current virtual-hardware stage, the emergency is cleared by restarting the device.

### Run the Wokwi/PlatformIO firmware

From the repository root:

```bash
pio run -d firmware
```

Opening `firmware/diagram.json` in Wokwi allows the virtual circuit to be inspected or simulated.

### Run host-side firmware tests

```bash
npm run test:firmware
```

Host tests exercise the firmware state machine, indicator behavior, and boot-time identity logic without requiring the ESP32 toolchain.

The virtual circuit and firmware demonstrate the hardware stage. They do not imply that the browser simulator has an active physical BLE connection to the ESP32.

---

## Repository Structure

```text
Project-NETRI/
├── contracts/       # Shared schemas and TypeScript types
├── firmware/        # ESP32 firmware, Wokwi circuit and host tests
├── simulator/       # Browser-based device simulator
├── gateway/         # Standalone simulated-BLE gateway
├── backend/         # REST API, SQLite incident engine and Socket.IO
├── dashboard/       # Organization administration interface
├── emergency/       # Responder operations interface
├── portal/          # Unified portal landing page and styling
├── RULES.md         # Authoritative product constraints
├── package.json     # Root scripts and npm workspaces
├── package-lock.json
└── README.md
```

---

## Deployment

The hosted application uses a unified portal and separately deployed gateway.

### Hosted services

| Service | URL |
|---|---|
| Portal and backend | `https://project-netri.onrender.com` |
| Gateway | `https://project-netri-gateway.onrender.com` |

The backend service serves the portal and production-built frontend assets under `/dashboard/`, `/emergency/`, and `/simulator/`.

The gateway runs as a separate web service and relays events to the backend.

### Required deployment configuration

**Main portal/backend service**

- Build the workspace applications before serving the portal.
- Set `VITE_GATEWAY_URL` to the public gateway URL before building the simulator bundle.
- Preserve the backend's configured start command and the static paths required by the portal.

**Gateway service**

Set:

```text
NETRI_BACKEND_URL=https://project-netri.onrender.com
```

Render supplies the service port through `PORT`.

### Deployment verification

After a deployment, verify all of the following:

1. The portal loads and its navigation opens all three applications.
2. The backend health endpoint returns a healthy response.
3. The gateway health endpoint returns a healthy response and the intended backend URL.
4. A trigger from the hosted simulator creates an incident in the hosted dashboard.
5. The responder console receives the live incident.
6. Acknowledgement, resolution, and organization cancellation follow the expected lifecycle rules.

The hosted services may experience cold starts or data resets depending on their instance and storage configuration. A successful health check does not by itself prove end-to-end incident delivery.

---

## Current Limitations

NETRI is a scoped prototype. The following are outside the current Round 1 implementation:

- User authentication and authorization
- External emergency-service integrations
- SMS, cellular, or other external notification providers
- Production physical BLE integration between the ESP32 device and a smartphone
- GPS/GNSS positioning
- Accelerometer-based automatic triggers
- Microphone, camera, AI, or surveillance functionality
- Production-grade persistent hosting and operational monitoring

The simulator and gateway demonstrate the intended communication boundary. They do not establish a production-ready emergency communication service.

---

## Project Goal

NETRI demonstrates how a dedicated emergency trigger can connect to an incident-management workflow that gives an organization visibility into an emergency and enables a coordinated responder action.

The central design principle is separation of concerns: device interaction, communication, incident processing, and response coordination remain distinct components that can be tested and developed independently.
