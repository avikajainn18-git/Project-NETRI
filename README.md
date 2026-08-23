# Project N.E.T.R.I.

**N.E.T.R.I. (Network for Emergency Threat Response and Intervention)** is a discreet personal-safety system integrated into an everyday compact mirror, designed to let a woman rapidly trigger a distress alert during an emergency without needing to navigate a conventional safety application.

---

## The Problem

In danger, you can't calmly unlock your phone and tap through an app.

Existing safety devices are one more thing to carry.

Compact mirrors are already in many women's bags—and nobody questions her holding one.

---

## The Solution

Tap your compact mirror **3 times** and it silently alerts trusted contacts and responders with your GPS location.

The proposed production system uses **GSM/SMS-based communication**, allowing alerts to be transmitted where cellular coverage is available when there is no internet connection.

---

## Key Features

* **Triple-tap activation** — Rapid and discreet emergency triggering
* **GSM/SMS fallback** — Enables emergency communication without requiring internet access
* **Multiple modes** — Distress alert, silent recording, and voice activation
* **Intelligent filtering** — Helps distinguish intentional emergency triggers from accidental activation
* **Everyday form factor** — Safety functionality integrated into a familiar compact mirror
* **Real-time response** — Responders can view location and incident details through the dashboard
* **Proven technologies** — Built around established hardware and software technologies reducing chances of failing

---

## How It Works

```text
[Device Detects]
       ↓
[Multiple Activation]
       ↓
[Alert Validation]
       ↓
[SMS / Data Alert]
       ↓
[Responder Dashboard]
       ↓
[Dispatch / Escalation]
       ↓
[Resolution]
```

---

## Tech Stack

### Phase 1 — Internal SIH MVP / Prototype

* **Device Simulator:** HTML, CSS, JavaScript + Geo-location API
* **Backend:** Node.js + Express, Socket.io, SQLite
* **Dashboard:** HTML, CSS, JavaScript, Leaflet + OpenStreetMap
* **Transport:** HTTP POST over Wi-Fi

### Phase 2 — Production / Real Hardware

* **Hardware:** ESP32 + ADXL345 accelerometer + MEMS microphone + GSM module + LiPo battery
* **Firmware:** C/C++ (Arduino / ESP-IDF), with on-device tap and voice detection
* **Backend:** Node.js + Express, PostgreSQL, AWS/GCP
* **Frontend:** React web application + React Native / Flutter mobile application
* **Connectivity:** Dual-path communication — GSM/SMS and cellular/BLE connectivity
* **Ingestion:** Twilio SMS Gateway + HTTPS API
* **Integration:** 112 ERSS, real-time WebSockets, and push notifications

---

## System Architecture

N.E.T.R.I. follows a layered architecture connecting the physical safety device to the emergency response system.

```text
┌─────────────────────────────────────────────────────────────┐
│                    N.E.T.R.I. COMPACT                       │
│                                                             │
│  Triple-Tap / Voice Trigger                                 │
│             ↓                                               │
│  MCU + Sensor Fusion + False-Alarm Filter                   │
│             ↓                                               │
│       Alert Confirmation                                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    CONNECTIVITY                             │
│                                                             │
│          ┌─────────────────┬─────────────────┐              │
│          │                 │                 │              │
│       GSM / SMS        Internet / App     GPS/GNSS          │
│       Fallback           Connection       Location          │
│          │                 │                 │              │
└──────────┴─────────────────┴─────────────────┴──────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND                                 │
│                                                             │
│  API / Alert Gateway                                        │
│          ↓                                                  │
│  Alert Processing & Validation                              │
│          ↓                                                  │
│  Location & Incident Management                             │
│          ↓                                                  │
│  Escalation Engine                                          │
│          ↓                                                  │
│  Database / Persistent Storage                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  EMERGENCY RESPONSE                         │
│                                                             │
│  Operator Dashboard    Emergency Contacts    112 / ERSS     │
│          │                    │                  │          │
│          └────────────────────┴──────────────────┘          │
│                           ↓                                 │
│              Acknowledge → Escalate → Resolve               │
└─────────────────────────────────────────────────────────────┘
```

### Architecture Flow

1. **Trigger** — The user activates N.E.T.R.I. through a predefined gesture or trigger.
2. **Validation** — The system processes the trigger and applies false-alarm protection.
3. **Communication** — The alert is transmitted with device identity and location information.
4. **Backend Processing** — The backend receives, validates, stores, and processes the incident.
5. **Response** — The incident appears on the responder dashboard and is communicated to designated contacts.
6. **Escalation** — Unacknowledged incidents can be escalated automatically.
7. **Resolution** — Operators can acknowledge, escalate/dispatch, and resolve the incident.

---

## MVP Architecture

The current SIH MVP represents the physical device through a software simulator and demonstrates the complete emergency-response workflow.

```text
Virtual N.E.T.R.I. Device Simulation
        ↓
     Backend
        ↓
   Live Dashboard
        ↓
 Alert Notification
        ↓
 Operator Actions
(Acknowledge / Escalate / Resolve)
```

The MVP focuses on validating the core software pipeline before physical hardware integration.

---

## Competitive Edge

| Factor       | N.E.T.R.I.                    | Conventional Apps / Devices          |
| ------------ | ----------------------------- | ------------------------------------ |
| Activation   | Triple-tap                    | Phone interaction / dedicated button |
| Connectivity | GSM/SMS fallback              | Typically internet/app dependent     |
| Form Factor  | Disguised everyday object     | Smartphone / dedicated wearable      |
| Recording    | Integrated                    | May require separate functionality   |
| Response     | Alert + location + escalation | Primarily SOS notification           |

---

## Future Feasibility

The modular compact design allows additional safety functions to be integrated in future, including expanded sensing, controls, and a dual-battery architecture with a primary LiPo battery and ultra-low-power backup for emergency operation.

---

## Risks & Mitigation

| Risk / Challenge                | Mitigation                                                 |
| ------------------------------- | ---------------------------------------------------------- |
| False or accidental activation  | Triple-tap detection + confirmation mechanism              |
| Network / GPS limitations       | Multi-channel communication and available location sources |
| Battery depletion               | Low-power architecture + future backup power system        |
| Delayed emergency response      | Automated escalation + centralized monitoring              |
| Hardware integration complexity | Modular design + readily available components              |

---

## Getting Involved

We welcome contributions across hardware, software, product design, and emergency-response integration.

* **Designers:** Compact mirror industrial design and responder-dashboard UI
* **Hardware Engineers:** ESP32 firmware and sensor calibration
* **Backend Developers:** Escalation logic, location handling, and 112 ERSS integration
* **Mobile Developers:** React Native / Flutter responder and user applications

---

## Project Vision

Team NETRI aims to transform an ordinary everyday object into a discreet, accessible, and responsive personal-safety system—reducing the friction between **recognizing danger and getting help**.
