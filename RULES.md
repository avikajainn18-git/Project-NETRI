# NETRI — RULES.md

> **THIS IS THE SINGLE AUTHORITATIVE PROJECT-CONTEXT AND GOVERNANCE FILE FOR NETRI.**
> It is the ONLY project documentation file in this repository. No other README, docs, or governance files may exist or be created; all persistent project knowledge lives here.
> **This is a LIVING document.** It MUST be updated whenever approved project state changes — decisions, phases, implementation milestones, scope — so any new agent can reconstruct the full project direction by reading this repository alone, never chat history.

**Status key used throughout this file:**

| Marker | Meaning |
|---|---|
| **APPROVED** | Ratified by the project owner (or stated directly in the approved project spec); binding |
| **PROPOSED** | Agent recommendation; NOT binding until the owner ratifies it |
| **PENDING** | Awaiting an explicit project-owner decision; no agent may finalize it |
| **EXCLUDED** | Explicitly rejected for the current design; must not be introduced or revived |
| **NOT YET IMPLEMENTED** | Approved or proposed in principle, but no code/artifact exists yet |

---

## 1. Project identity

- **Name:** NETRI
- **Full form:** Network for Emergency Threat Response and Intervention
- **Category:** IoT (embedded systems, ESP32, sensors, BLE, smartphone gateway, backend infrastructure, real-time communication, organization dashboard). NOT primarily an AI/ML or sustainability project.
- **One-line pitch:** NETRI is an organizational emergency communication system that provides a dedicated, low-friction emergency communication pathway connecting a physical IoT device, smartphone gateway, backend infrastructure, and organization-managed response workflow.

## 2. Purpose and core problem

- **Core problem:** EMERGENCY COMMUNICATION FAILURE — emergency communication becomes difficult when a smartphone is inaccessible, unavailable, out of battery, impractical to use, too difficult to operate during panic or stress, or otherwise unsuitable for the situation.
- **Core identity:** RELIABLE EMERGENCY COMMUNICATION. Nothing else.
- NETRI provides a dedicated emergency communication pathway designed specifically for these situations. It is **not positioned as**: a women's-safety product, a crime-prevention product, a surveillance system, a crime-detection system, or an AI threat-prediction system.

## 3. B2B model

- **Business model:** B2B. NETRI provides the communication and incident-management infrastructure only.
- **Customer:** the organization — universities, colleges, corporate campuses, manufacturing plants, hostels, research facilities, field operations, and similar organizations responsible for employee/student safety.
- **End user:** employee/student/other authorized personnel carrying the NETRI device.
- **Operator:** organization-designated response/security personnel.
- The organization **owns and operates** the response dashboard. **NETRI does not provide the emergency workforce itself.**

## 4. Product definition

**APPROVED (spec):** the NETRI product is a dedicated, low-friction physical emergency device — carried by the end user — that sends an emergency event over BLE to the user's smartphone, which acts as a gateway to the organization's backend, which drives an organization-operated response dashboard.

**Round 1 produces TWO connected representations of this product:**
1. a **virtual electronics/hardware simulation** (Wokwi) — representing the electronics to be physically built, and
2. the **NETRI software platform** — demonstrating the complete emergency-response workflow.

**Division of responsibility (APPROVED):** Wokwi represents the *electronics*; the NETRI hardware simulator (software) represents the *user-facing device experience* — physical appearance, trigger interaction, device state, connectivity state, status indicators, and device feedback. The simulator is not a generic SOS webpage; its visual design must correspond to the eventual physical device. These are two different artifacts and must not be conflated.

## 5. Round-1 scope

**APPROVED:** Round 1 is a software-first digital prototype with a realistic virtual hardware demonstration. Goal: demonstrate that the complete system works conceptually and technically **before building the final physical hardware**. The virtual circuit should represent the intended physical electronics (intended hardware = Wokwi virtual hardware = future physical prototype).

**Implementation status:** Phase 1 (Virtual Hardware) is implemented (see §8, §10); Phases 2–6 are NOT YET IMPLEMENTED — no gateway, backend, database, dashboard, or end-to-end integration exists.

## 6. Complete architecture

**APPROVED pipeline (one direction of event flow, responder actions flowing back: ack stops escalation → resolve/cancel closes the incident):**

```
NETRI DEVICE (ESP32 firmware + sensors + LEDs)
      ↓  BLE (simulated transport in Round 1)
SMARTPHONE / GATEWAY (receives device events, relays to backend)
      ↓  HTTP / WebSocket
BACKEND (incident engine, database)
      ↓  Socket.IO (real-time)
EMERGENCY CONSOLE (responders) & ORG DASHBOARD (admins)
      ↓
DESIGNATED RESPONSE PERSONNEL & ADMINISTRATORS
```

The smartphone is conceptually the **gateway** between the NETRI device and the backend.

**Module separation (roles APPROVED; per-module tech PROPOSED) — all NOT YET IMPLEMENTED:**

| Module | Role (APPROVED) | Proposed tech |
|---|---|---|
| `firmware/` | ESP32 firmware: trigger logic, LED status, event generation, BLE concept | Arduino C++ on Wokwi |
| `simulator/` | User-facing virtual NETRI device: look, trigger interaction, state, feedback | Vite + React + TS |
| `gateway/` | Smartphone stand-in: receives device events over simulated BLE, authenticates as the organization's phone, relays to backend | Node + TS |
| `backend/` | Incident engine: create/dedup/persist, severity, escalation, ack/resolve/cancel; REST + Socket.IO | Node + Express + SQLite + Socket.IO |
| `emergency/` | Emergency Dept. responder console: live incidents, timeline, responder actions (ack/resolve) | Vite + React + TS + Socket.IO client |
| `dashboard/` | Organization oversight/administration: admin overrides, cancellation, system overview | Vite + React + TS + Socket.IO client |
| `contracts/` | Shared event/API/message schemas — single source of truth across modules | TS types + Zod (PROPOSED) |
| `config/` | Escalation thresholds, org settings, device registry, ports | JSON |

**Hard rule:** no module imports another module's internals; all boundaries cross through `contracts/` (runtime-validated). Both `emergency/` and `dashboard/` communicate ONLY through the backend; they never communicate directly. Firmware keeps its transport behind a single abstraction so swapping simulated BLE for real BLE in the physical build touches one module.

**PROPOSED target repository layout (NOT YET IMPLEMENTED):**

```
netri/
├── RULES.md                  ← this file (the only documentation)
├── contracts/src/            # events, incidents, socket contracts
├── config/                   # escalation.json, org.json (devices, ports)
├── firmware/                 # main.cpp, triggers/indicators/transport headers,
│                             # diagram.json (Wokwi circuit), wokwi.toml
├── simulator/src/            # device/ (visuals), state/, transport/
├── gateway/src/              # ble/ (simulated receiver), relay/, auth/
├── backend/src/              # server, db/, incidents/, api/, realtime/
├── emergency/src/            # responder console (incidents/, actions/)
├── dashboard/src/            # admin dashboard (oversight/, cancellation/)
└── tests/                    # integration + e2e flow tests
```

## 7. Communication architecture

**APPROVED:** the §6 pipeline. Location is used only "where available"; no GPS/GNSS hardware (see §16, §18).

**Gateway form (APPROVED, D4):** the smartphone gateway is a **standalone Node process** — a separate module/process from the NETRI device simulator.

**Location model (APPROVED, D3):** incidents carry **organization-assigned location zones** (e.g. Library, Hostel 2, Lab 304, Block A), attached to devices in configuration. No GPS/GNSS hardware.

**Simulated BLE (APPROVED for Round 1):**
- Wokwi does **not** provide true BLE passthrough between a simulated ESP32 and the host/browser (open upstream feature request since 2021). This is a verified technical limitation, not a preference.
- Round 1 therefore uses a **clearly defined simulated BLE transport while preserving the intended real-world architecture**: firmware logic is written as if BLE were real; the transport sits behind an abstraction; the device/gateway/backend/dashboard separation is fully preserved.

**PROPOSED transports (not ratified):** ESP32→gateway over true WebSocket via Wokwi WiFi (`Wokwi-GUEST`, or the IoT Gateway tool for localhost); gateway→backend over HTTP POST, with Socket.IO for acks/state; gateway queues/retries when the backend is unreachable.

**EXCLUDED:** GSM, cellular modules, SIM-based communication, SMS hardware, cellular fallback. Do not add them under any circumstances unless the owner explicitly instructs it later.

## 8. Hardware / BOM

**Status: APPROVED for Round 1 / Phase 1** (explicit owner approval) and **implemented** — the Wokwi circuit (`firmware/diagram.json`, exactly the components below) and firmware exist. Agents must still not add hardware beyond this list.

**APPROVED Round-1 BOM (exact and complete):**

| # | Component | Qty | Role |
|---|-----------|-----|------|
| 1 | ESP32 DevKit V1 | 1 | Main MCU — trigger logic, state, transport |
| 2 | Tactile push button | 1 | Emergency trigger (primary, low-friction deliberate press) |
| 3 | LED — status (green) | 1 | System state: boot, idle, link to gateway |
| 4 | LED — alert (red) | 1 | Emergency state: armed, transmitted, ack-received |
| 5 | Resistors 220 Ω | 2 | LED current limiting |

**Explicit records (owner-approved):**
- **ADXL345 is DEFERRED (D1) and is NOT part of the Round-1 BOM.** No accelerometer; no automatic fall/impact trigger.
- **Battery/power circuitry is DOCUMENTATION-ONLY (D2).** It remains part of the intended physical device design but is NOT simulated as a Round-1 hardware component.
- **No additional sensors/components may be added without explicit owner approval** (see §15).
- **Phase 1 implementation (current):** the approved circuit + firmware exist in the repository under `firmware/` — Wokwi `diagram.json` (exact approved BOM), Arduino sketch + module headers, PlatformIO config, and host-side logic tests. First Wokwi simulation run still pending.

**APPROVED trigger (D5):** the physical button is the **only** emergency trigger — physical press only, no test hooks or alternate injection mechanisms. The button is wired to **GPIO 25** (rendered pin `D25` on Wokwi's ESP32 DevKit V1; green LED GPIO 26 `D26`, red LED GPIO 27 `D27`). **APPROVED (owner Phase-1 task):** press-and-hold with a **2-second threshold measured from press start**; a press shorter than 2 s never triggers. **APPROVED (owner directive): the emergency LATCHES after trigger** — releasing the button does NOT re-arm or clear the emergency (the red alert LED stays on), and a fresh press cannot re-fire while latched. The latch clears only through a future RESOLVE mechanism (Phase 2+) or, in Phase 1, a restart/power-cycle. Implemented in the trigger FSM (host-tested).

**Owner-directed Phase-1 indication (APPROVED, implemented):** GREEN status LED = device operational/normal, **ON by default** (boot + idle); RED alert LED = active emergency, OFF normally. After a valid ≥2 s hold the emergency **latches**: RED stays on and GREEN stays off after the button is released, until RESOLVE (future) or restart/power-cycle (Phase 1).

| State | Status LED (green) | Alert LED (red) | Status |
|---|---|---|---|
| Boot / self-test | solid | off | APPROVED, implemented |
| Idle / ready (operational) | solid | off | APPROVED, implemented |
| Arming (hold in progress) | fast blink | off | APPROVED, implemented |
| Emergency (latched) | off | solid, held until RESOLVE/restart | APPROVED, implemented |
| Linked to gateway | solid | off | PROPOSED draft — NOT YET IMPLEMENTED (Phase 3+) |
| Awaiting acknowledgement | off | slow blink | PROPOSED draft — NOT YET IMPLEMENTED (Phase 3+) |
| Acknowledged by responder | off | double-blink pattern | PROPOSED draft — NOT YET IMPLEMENTED (Phase 3+) |
| Fault / link lost | fast blink | off | PROPOSED draft — NOT YET IMPLEMENTED (Phase 3+) |

## 9. Official roadmap — the six Round-1 phases (APPROVED)

1. **Virtual Hardware** — Wokwi ESP32 + approved BOM, wiring, firmware, trigger logic, status indicators. Deliverable: circuit + firmware where trigger → event → "BLE" emit works and LEDs reflect state.
2. **NETRI Hardware Simulator** — polished software simulator visually representing the actual device (appearance, trigger interaction, state, connectivity, feedback).
3. **Communication Layer** — device → (simulated) BLE → smartphone gateway → backend, with connection status.
4. **Backend + Incident Engine** — REST API, database persistence, dedup, severity, escalation, ack/resolve/cancel, Socket.IO hub.
5. **Frontends** — Responder Console (emergency/) & Organization Dashboard (dashboard/): live incident list, timeline, responder actions, and administration.
6. **End-to-End Integration** — full workflow: trigger → firmware → transport → gateway → backend → dashboard → responder action → resolved incident.

**Rules:** build phase-by-phase; **do not implement all six phases at once**; each phase ends at a working checkpoint before the next begins; do not create additional phases (including any "Phase 0") without explicit owner approval — shared contracts/config work may only be folded into the plan if the owner approves it.

## 10. Current project state

- **Stage:** Phase 1 (Virtual Hardware) implemented at the code level: approved-BOM Wokwi circuit (`firmware/diagram.json`), ESP32 firmware (`firmware/sketch/sketch.ino` + `firmware/include/netri/` headers), PlatformIO config, passing host-side logic tests (`firmware/test/`), and a **successful PlatformIO esp32dev build** (`firmware/.pio/build/esp32dev/firmware.bin`). First Wokwi simulation run pending.
- **Phase 2 (Hardware Simulator) implemented at the code level:** the user-facing device simulator exists under `simulator/` (Vite + React + TypeScript — the §6 PROPOSED per-module stack, used de facto pending owner ratification) and reproduces the Phase-1 device behavior 1:1: green operational by default, 2 s continuous hold to trigger, emergency LATCHES (release does not clear), RESET/power-cycle clears, device ID NETRI-001, console mirroring the firmware serial lines, and an `EMERGENCY_TRIGGERED` event seam where the Phase-3 transport will subscribe. Cutaway visualization of the approved BOM only; no networking/backend/Phase-3 functionality. Typecheck + production build pass; core interactions verified in-browser (see §11 Task 9).
- **Implemented so far:** RULES.md + `firmware/` (Phase 1 only). No gateway, backend, database, dashboard, transport (boundary stub only), or dependencies beyond the toolchain; nothing committed.
- **Approvals in force:** BOM APPROVED (§8); D1–D6 APPROVED (§14); 2 s hold threshold, emergency LATCH (release does not re-arm or clear; RESOLVE/restart clears), and green-solid operational indication APPROVED (owner directives, §8/§14). No PENDING decisions remain.
- **Verified environment facts (APPROVED):** Wokwi supports ESP32 simulation with WiFi networking (free `Wokwi-GUEST`; the separate IoT Gateway tool bridges localhost); it does **not** support BLE passthrough.

## 11. Completed work and history

| When | What |
|---|---|
| Task 1 | Architecture package authored: ARCHITECTURE/BOM/DECISIONS/RUNBOOK docs + README |
| Task 2 | Owner-directed consolidation: RULES.md created as authoritative; docs demoted to subordinate references; unofficial "Phase 0" removed; tool choices reclassified as PROPOSED; open-decision list unified as D1–D6 |
| Task 3 | Owner-directed single-file consolidation: all useful content from the four docs + README merged into RULES.md; README and docs/ deleted; repository now has exactly one project-context file |
| Task 4 | Owner explicitly resolved D1–D6 (D1 defer ADXL345 · D2 battery docs-only · D3 org-assigned zones · D4 standalone gateway process · D5 physical-press-only triggers · D6 boot-time selectable device IDs) and approved the Round-1 BOM (§8). BOM gate opened; Phase 1 authorized but NOT started |
| Task 5 | Phase 1 Virtual Hardware implemented: approved-BOM Wokwi circuit + structured firmware (boot-time device ID per D6, 2 s hold-to-trigger per D5, LED indicators, `ITransport` boundary stub, no test hooks) + host-side FSM/indicator tests, all passing. First Wokwi simulation run pending |
| Task 6 | Owner-directed corrective review of the D6 selector: original GPIO 34/35 pins are input-only and have no internal pull-ups (Espressif ESP-IDF GPIO docs), so `INPUT_PULLUP` was silently ignored there. Selector moved to GPIO 32/33 (pull-up-capable); BOM, D6 behavior, and diagram.json unchanged; 11/11 selector tests added including an input-only-pin regression guard. On-target verification remains pending |
| Task 7 | Owner-directed PlatformIO build-path fix: `src_dir` is honored ONLY in the global `[platformio]` section (PIO team statement in the official community + observed behavior) — placing it in `[env:...]` is silently ignored, causing "Nothing to build … firmware\\src". Moved `src_dir = sketch` to `[platformio]` and added `build_flags = -Iinclude/netri` (env-valid) for the preserved header layout. `pio run -d firmware` now SUCCEEDS (esp32dev, RAM 6.6 %, Flash 20.6 %), producing `.pio/build/esp32dev/firmware.bin` + `firmware.elf` exactly as `wokwi.toml` expects. No architecture, BOM, or hardware changes |
| Task 8 | Owner-directed Phase-1 behavior corrections: (a) Wokwi trigger was dead — `diagram.json` used `esp:25/26/27` but Wokwi renders those pins as `D25/D26/D27`; wiring fixed to `esp:D25/D26/D27` (button GPIO 25, LEDs GPIO 26/27); (b) LED indication per owner directive: green solid at boot/idle (operational, ON by default), red alert = emergency; (c) emergency LATCHED per owner directive: release no longer re-arms — `EMERGENCY` is terminal in the trigger FSM until restart/power-cycle (no RESOLVE mechanism in Phase 1); the now-unreachable `DEBOUNCE_AFTER` state was removed. Host tests updated and passing (30 trigger / 33 indicator / 11 identity checks); PlatformIO build re-verified (SUCCESS, Flash 20.6%). First Wokwi runtime verification attempt was blocked by a browser rendering stall (build + serial connected, sim engine frozen — not a firmware issue); owner performing independent manual verification |
| Task 9 | Phase 2 Hardware Simulator implemented in `simulator/` (Vite + React + TS, §6 PROPOSED stack): pure trigger FSM mirroring `netri_trigger.h` semantics (2 s continuous hold anchored at press start, 40 ms debounce, latched EMERGENCY with release/re-press as no-ops, reset as the only Phase-2 exit), DeviceController store emitting `EMERGENCY_TRIGGERED delivered=false` at the Phase-3 seam, cutaway SVG hardware visualization of the approved BOM (ESP32 DevKit V1 with ESP-WROOM-32 shield/USB/BOOT/EN, tactile SOS trigger, green/red LED domes, 2× 220 Ω resistors with true color bands, PCB copper traces, frosted cover with LED window/SOS dimple/RESET pinhole), BOM legend, console mirroring Phase-1 serial output with device-up timestamps. Strict typecheck + production build pass; browser-verified: idle green, short press ignored, ≥2 s hold → ARMING then red latched, release keeps red, RESET restores green + fresh boot lines. No firmware changes, no networking |
| Task 10 | Owner formally ratified Phase 4/5 data-contract architecture: Frontend split (`emergency/` vs `dashboard/`), Incident lifecycle (`ACTIVE -> ASSIGNED -> ACKNOWLEDGED -> RESOLVED`), backend-owned deterministic automatic assignment, backend-authoritative responder availability, and organizational-actor-only cancellation. Old contradictory proposals removed. |

## 12. Incident-domain requirements

**APPROVED (Phase 4/5 requirements):**
- Severity ladder **MEDIUM → HIGH → CRITICAL**.
- Escalation on configured **non-response thresholds**; responder action **stops/cancels** escalation.
- Backend: receive emergency events; create incidents with generated incident IDs; store timestamps, device/user info, location where available (organization-assigned zones, D3); **prevent duplicate incidents**; maintain incident status; handle acknowledgement, resolution, cancellation, escalation. Incident states **persist in the database** (SQLite per preferred stack Node.js + Express + SQLite + Socket.IO).
- Dashboard displays: incident ID, severity, status, timestamp, location, device/user info where appropriate, escalation state, response state, incident timeline; real-time via Socket.IO.

**PROPOSED (not ratified):** deduplication via a per-device debounce window plus device-side suppression; incident states `ACTIVE → ACKNOWLEDGED → RESOLVED` (+ `CANCELLED`); canceller may be the end user (before ack) or a responder.

## 13. Engineering rules

**APPROVED:** a real engineering prototype, not a static visual mockup. Modular architecture; clean separation of concerns; readable code; proper API design; validation; error handling; persistent state; testability; clear interfaces between hardware, gateway, backend, and dashboard.

**Avoid:** monolithic files; duplicated logic; unnecessary dependencies; fake hardcoded success flows; unnecessary complexity.

**Honesty about simulation (binding):** simulated transport must remain clearly identified as simulated, in code and UI; never present simulated behavior as real hardware behavior.

## 14. Decisions

### APPROVED

| Decision |
|---|
| Round 1 = software-first prototype with virtual hardware |
| Wokwi + ESP32 as the Phase 1 virtual-hardware platform |
| Simulated BLE transport for Round 1, architecturally separated |
| BOM must be explicitly approved before Phase 1 begins |
| Five modules (firmware/simulator/gateway/backend/dashboard) + shared contracts/config; boundary rule in §6 |
| Preferred backend stack: Node.js + Express + SQLite + Socket.IO |
| Severity ladder MEDIUM→HIGH→CRITICAL with threshold escalation; ack stops escalation |
| The six official phases (§9) |
| **D1:** ADXL345 accelerometer DEFERRED from Round 1 — no accelerometer, no automatic fall/impact trigger |
| **D2:** Battery/power is DOCUMENTATION-ONLY — part of the intended physical design, not simulated in Round 1 |
| **D3:** Location = ORGANIZATION-ASSIGNED ZONES (e.g. Library, Hostel 2, Lab 304, Block A); no GPS/GNSS hardware |
| **D4:** Smartphone gateway = STANDALONE NODE PROCESS, separate from the device simulator |
| **D5:** Triggering/testing = PHYSICAL PRESS ONLY — no test hooks, no trigger-injection mechanism |
| **D6:** Device identity = BOOT-TIME SELECTABLE predefined IDs (e.g. NETRI-001, NETRI-002, NETRI-003); no full provisioning system |
| Round-1 BOM APPROVED for Phase 1 — exactly the five components in §8 |
| Button hold duration = 2 s, measured from press start (owner Phase-1 task) |
| Emergency LATCH: after a valid ≥2 s hold the emergency latches — release does NOT re-arm or clear it, and it clears only via a future RESOLVE mechanism or, in Phase 1, restart/power-cycle (owner directive) |
| Frontend UI split: separate `emergency/` (responder console) and `dashboard/` (org administration), communicating only through backend |
| Incident lifecycle: `ACTIVE → ASSIGNED → ACKNOWLEDGED → RESOLVED (+ CANCELLED)` |
| Automatic assignment: backend-authoritative, selects oldest continuously AVAILABLE responder |
| Responder availability: backend-authoritative via lifecycle events, no frontend overrides |
| Cancellation: restricted to org actors via backend; no end-user cancellation |
| Authentication / Identity implementation: DEFERRED |

### PROPOSED (non-binding agent recommendations)

| Topic | Recommendation |
|---|---|
| SQLite driver | better-sqlite3 (synchronous, zero-config) |
| Shared contracts | Zod schemas with inferred TS types |
| Repository shape | npm-workspaces monorepo |
| Frontend stack | Vite + React + TS (simulator, emergency, dashboard) |
| Simulated-BLE receiver placement | inside the gateway module |
| Transport details | WebSocket device→gateway; HTTP POST gateway→backend; Socket.IO acks/state |
| Dedup mechanism | per-device debounce + device-side suppression |

### PENDING — DO NOT finalize, select, or implement without explicit owner approval

**None.** D1–D6 were resolved by the owner and are recorded under APPROVED above (see §11, Task 4). New pending decisions will be added here as they arise and must not be treated as approved.

## 15. Excluded / removed concepts (EXCLUDED)

Never introduce or revive any of these unless the owner explicitly instructs it:

- GSM / cellular / SIM / SMS communication (hardware or fallback)
- GPS / GNSS hardware
- Microphone, buzzer, speaker; camera; display; any sensors/components beyond the approved Round-1 BOM (includes the deferred ADXL345 — D1)
- AI threat prediction, machine-learning classification, behavioral monitoring
- Surveillance, crime detection, evidence locker, audio evidence storage
- Advanced analytics, nationwide monitoring center
- Social features, consumer marketplace features
- Positioning NETRI as a women's-safety or crime-prevention product
- Trigger test hooks or any alternate trigger-injection mechanism (D5)
- Implementing multiple phases simultaneously; skipping approval gates; unofficial "Phase 0"
- Multiple competing documentation/governance files

## 16. Known technical limitations

- **Wokwi BLE:** no true BLE passthrough to host/browser (open upstream feature request since 2021) → Round 1 simulates the BLE transport by design (approved workaround, not an architectural change).
- **Wokwi networking:** simulated ESP32 reaches the internet via `Wokwi-GUEST`; reaching a localhost backend requires the Wokwi IoT Gateway tool (relevant Phase 3+).
- **Wokwi battery:** discharge is not meaningfully simulatable — reflected in the approved D2 (battery/power is documentation-only in Round 1).
- **Round 1 is a prototype:** it demonstrates the workflow conceptually and technically; it is not a certified emergency system and must never be represented as one.

## 17. Future physical-device transition (planning notes)

- **Principle (APPROVED):** intended physical hardware = Wokwi virtual hardware = future physical prototype. The physical build reuses the approved BOM and the same firmware logic.
- **Expected swaps at physical build:** simulated BLE → real BLE (contained in the firmware transport abstraction + gateway receiver, per §6); battery/power realized as physical hardware (D2 keeps it documentation-only in Round 1); device identity per D6 (boot-time selectable IDs).
- **Unchanged:** architecture pipeline, backend, dashboard, contracts, incident engine.
- **New concerns to plan later (not decided):** enclosure and assembly, real-world radio range/reliability testing, power profiling, device provisioning at organizational scale, safety/regulatory review. None of this affects Round 1 deliverables.

## 18. Testing / verification status

**Host-side logic tests + real-toolchain build (Phase 1).** The exact modules the firmware runs are unit-tested on the host: 30/30 trigger-FSM checks (2 s threshold exactness, short-press rejection, one-shot firing, contact-bounce immunity, emergency latch — release does not re-arm and a fresh hold cannot re-fire while latched), 33/33 LED-indicator checks, and 11/11 D6 identity-selector checks — including a regression guard that fails if the selector ever returns to input-only GPIOs 34–39, which have no internal pull-ups — all passing (`firmware/test/`, plain g++, no dependencies). Additionally, the firmware **cross-compiles cleanly for esp32dev** with PlatformIO Core 6.2.0 (build SUCCESS; `firmware/.pio/build/esp32dev/firmware.bin` + `firmware.elf` present, matching `wokwi.toml`). **Not yet verified:** a Wokwi simulation run, module integration, end-to-end behavior, or physical hardware. (A first Wokwi runtime attempt was blocked by a browser rendering stall — build POST succeeded and serial connected, but the sim engine never advanced; owner manual verification pending.) The Phase-2 simulator's TypeScript FSM is not host-unit-tested (it independently re-implements the rules verified by the Phase-1 C++ suites); its behaviors were verified interactively in the browser (§11 Task 9). A future agent must not assume more has been verified than this.

## 19. Planned operational baselines (PROPOSED — for future implementation phases)

- **Prerequisites (planned):** Node.js ≥ 20, npm ≥ 10 (workspaces), free Wokwi account (Phase 1), Wokwi IoT Gateway tool (only if the simulated ESP32 must reach a local backend, Phase 3+).
- **Planned default ports (all configurable in `config/`):** backend REST + Socket.IO `4000`; gateway `4001`; dashboard `5173`; simulator `5174`.
- **Example demo flow (target of Phase 6):** trigger NETRI → ESP32 detects → event generated → gateway receives/forwards → backend creates incident → dashboard updates in real time → escalation begins if unacknowledged → responder acknowledges (escalation stops) → responder resolves.

## 20. Agent operating rules (binding on every agent)

1. **RULES.md first:** read this file completely before any project work.
2. **Respect the status key:** never silently promote PROPOSED → APPROVED or PENDING → APPROVED. Only the project owner approves decisions.
3. **Phase discipline:** implement only the phase currently approved for work; never the next phase, never several at once.
4. **BOM gate:** never build the Wokwi circuit or firmware before the owner approves the BOM.
5. **No scope creep:** the EXCLUDED list (§15) is absolute — no extra sensors, radios, AI, surveillance, or "helpful" extras.
6. **Architecture changes are never silent:** any deviation from §6/§7/§9 must be presented to the owner as a decision, never implemented unilaterally.
7. **Honesty about simulation:** no fake hardcoded success flows; simulated behavior always labeled as simulated.
8. **Disagreement protocol:** if this file and the actual repository disagree, stop and report/ask — never guess or silently "fix" either side.
9. **Assume nothing undocumented exists:** never rely on functionality, files, or services not evidenced in the repository.
10. **Never revive excluded concepts** (§15).
11. **Minimal footprint:** read only files relevant to the requested task; keep project-level truth here, not per-line code commentary.
12. **One documentation file:** never create READMEs, docs folders, or governance files; everything goes into this file.
13. **Do not push, commit, or deploy** unless the owner explicitly asks.

## 21. Documentation update procedure

- This file is the **single source of project context** and a **LIVING document**. Every approved decision, phase transition, implementation milestone, scope change, or verified environment fact MUST be reflected here **in the same change-set** that makes it.
- When the owner approves a decision, record it in §14 APPROVED with the exact outcome; never leave it ambiguous.
- Append significant governance/consolidation events to §11 (history).
- Keep entries compact: project-level truth, not implementation trivia. Detailed per-module documentation belongs in code/docstrings once implementation exists.

## 22. New-agent startup procedure (MANDATORY)

Before doing ANY project work, a freshly started agent MUST:

a. **Read this RULES.md completely.**
b. **Inspect the actual repository** (file tree and relevant files; do not assume §10/§11 snapshots are current — they are updated only as changes land).
c. **Determine the current project phase** and implementation state.
d. **Compare RULES.md against the actual implementation**; identify drift in either direction.
e. **Identify documentation/code conflicts.**
f. **Stop and report conflicts instead of guessing** or silently resolving.
g. **Never revive excluded functionality** (§15).
h. **Never silently change architecture** — surface deviations as proposals for owner approval.
i. **Never treat PROPOSED or PENDING decisions as approved.**
j. **Update RULES.md after approved project-state changes** — this is what keeps the repository self-describing.

**Default first question if context is unclear:** "Which phase is approved for work, and which decisions in §14 remain PENDING?"
