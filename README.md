Project-NETRI

A smart compact mirror that sends your location & distress alert with a triple-tap—no phone unlock needed. Works offline.

---

## The Problem

In danger, you can't calmly unlock your phone and tap through an app. 
Existing safety devices are one more thing to carry. 
Compact mirrors are already in every woman's bag—and nobody questions her holding one.

## The Solution

Tap your compact mirror 3 times and it silently alerts trusted contacts & responders with your GPS location. 
All via GSM signal—works on a bus, in a lift, anywhere there's cell coverage. 
No internet. No app.

---

## Key Features
- **Triple-tap activation**     —   instant, hands-free
- **Offline works**             —   GSM/SMS only, no data needed
- **Multiple modes**            —   distress alert, silent recording, voice activation
- **Intelligent filtering**     —   knows real emergency from bag bump
- **Already-carry form factor** —   compact mirror is unsuspicious
- **Real-time dispatch**        —   responders see live location + details

---

## How It Works:
[Device Detects] → [Multiple Activation] → [SMS/Data Alert] → [Responder Dashboard] → [Dispatch]

---

## Tech Stack

**Phase 1 (This Weekend) — Prototype**
- Device    :  (HTML/CSS/JS + Geolocation API)
- Backend   :  Node.js + Express, Socket.io, SQLite
- Dashboard :  HTML/CSS/JS, Leaflet + OpenStreetMap
- Transport :  HTTP POST over WiFi

**Phase 2 (Production) — Real Hardware**
- Hardware      :    ESP32 + ADXL345 accelerometer + MEMS mic + GSM module + LiPo
- Firmware      :    C/C++ (Arduino/ESP-IDF), on-device tap/voice detection
- Backend       :    Node.js + Express (scaled), PostgreSQL, AWS/GCP
- Frontend      :    React web app + React Native/Flutter mobile
- Connectivity  :    Dual-path (GSM/SMS offline + cellular/BLE online)
- Ingestion     :    Twilio SMS Gateway + HTTPS API
- Integration   :    112 ERSS, real-time WebSockets, push notifications

---

## Competitive Edge

|          Factor           |          Our Solution          |    Competitors (Apps)     |
|---------------------------|--------------------------------|---------------------------|
| Activation                | Triple-tap (instant)           | Unlock phone + app (3–5 sec) |
| Offline                   | ✓ Works on GSM/SMS             | ✗ Needs internet          |
| Form Factor               | Compact mirror(always carried) | Phone/smartwatch (obvious) |       
| Recording                 | ✓ Built-in                     | ✗ Separate                |
| Cost                      | ~$60–80 device + $2–5/mo       | Phone + $5–15/mo app       |

---

## Getting Involved

- **Designers:** Compact mirror industrial design, UI for responder dashboard
- **Hardware Engineers:** ESP32 firmware, sensor calibration
- **Backend Developers:** Escalation logic, location resolution, 112 ERSS integration
- **Mobile Developers:** React Native/Flutter responder & user apps

