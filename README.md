Project-NETRI

🎯 One Line:
A smart compact mirror that sends your location & distress alert with a triple-tap—no phone unlock needed. 
Works offline.

⚠️ The Problem:

When danger strikes, you can't calmly unlock your phone and tap through an app.

In real emergencies:

❌ Safety apps require you to unlock your phone first (impossible if someone grabs you)
❌ Separate safety devices are one more thing to remember and carry
❌ Most need internet/data—don't work in lifts, on buses, anywhere offline
❌ False alarms from accidental triggers overwhelm responders

The insight: Compact mirrors are already in every woman's bag. Nobody questions her holding one. It's the perfect form factor.

✨ The Solution:
🪞  →  TAP 3x / SAY WORD / RECORD  →  📍 LOCATION SENT  →  🚨 RESPONDERS ALERTED

Tap your compact mirror and it silently sends your GPS location + distress alert to trusted contacts & responders.

No phone unlock needed — just tap, done
Works offline — GSM/SMS signal, no data required
Multiple activation modes — triple-tap, voice word, or recording
Intelligent, not paranoid — filters accidental bumps from real emergencies
Already-carry design — compact mirror is unsuspicious, always in hand


🚀 Key Features
Feature	What It Does
🔘 Triple-Tap       -   Instant emergency alert (fastest activation)
🎙️ Voice Activation -	 Say your chosen word to trigger alert
🎬 Silent Recording	-   Different tap pattern starts recording for evidence
📡 Offline First	-   Works on GSM/SMS—no internet needed
🧠 Smart Filtering	-   Knows real emergency from accidental bag bump
📍 Live Tracking	-   Responders see your location in real-time
🗣️ Multi-Channel	 -   SMS, push notifications, dashboard alerts

🛠️ How It Works:
Device Activation → Alert Dispatch → Responder Action
┌─────────────────────────────────────────────────────────────┐
│ DEVICE ACTIVATION                                           │
│ ┌─────────────┬──────────────┬─────────────┐               │
│ │ Triple-Tap  │ Voice Word   │ Recording   │               │
│ └─────────────┴──────────────┴─────────────┘               │
│                      ↓                                       │
│ ALERT ROUTES (Smart Detection)                             │
│ ┌──────────────────┬──────────────────┐                    │
│ │ ONLINE PATH      │ OFFLINE PATH     │                    │
│ │ ├─ Cellular Data │ ├─ GSM/SMS       │                    │
│ │ ├─ BLE to Phone  │ └─ SMS Gateway   │                    │
│ │ └─ HTTPS API     │                  │                    │
│ └──────────────────┴──────────────────┘                    │
│                      ↓                                       │
│ BACKEND PROCESSING                                          │
│ ├─ Location Resolve (GPS / Cell Tower / IP)               │
│ ├─ De-Duplication (same incident, not spam)               │
│ ├─ Escalation Logic (rank responders)                     │
│ └─ Real-Time Dashboard Update                             │
│                      ↓                                       │
│ RESPONDER ACTION                                            │
│ ├─ Live Map + Location                                    │
│ ├─ Accept / Decline Alert                                 │
│ ├─ Track Device Location in Real-Time                     │
│ └─ Confirm Arrival + Report                               │
└─────────────────────────────────────────────────────────────┘

💻 Tech Stack:
🔬 Phase 1: Prototype (This Weekend)

What we're building NOW to prove the concept

Layer	Technology
🖥️ Device Simulator  -	  HTML/CSS/JS + Browser Geolocation API
🔌 Transport	     -   HTTP POST over WiFi (fetch)
🖲️ Backend	          -   Node.js + Express, Socket.io, SQLite
📊 Dashboard	     -   HTML/CSS/JS, Leaflet + OpenStreetMap
🔔 Notifications	 -   Telegram Bot API (testing)
🚀 Deployment	     -   Git + GitHub, localhost on phone hotspot

Result: Full-stack working prototype running in browser. Prove the workflow end-to-end.

🏭 Phase 2: Production (2–3 months)

Real hardware + cloud infrastructure

Hardware 🔧
┌──────────────────────────────────────┐
│       COMPACT MIRROR DEVICE           │
│  ┌────────────────────────────────┐  │
│  │  ESP32 Microcontroller         │  │
│  │  • ADXL345 Accelerometer       │  │
│  │  • MEMS Microphone             │  │
│  │  • Wake-word Engine (on-device)│  │
│  │  • GSM Module (SIM800L)        │  │
│  │  • LiPo Battery + Charging     │  │
│  │  • Haptic Feedback / LED       │  │
│  │  • Optional: MicroSD Recording │  │
│  └────────────────────────────────┘  │
│    (Embedded in aluminum frame)      │
└──────────────────────────────────────┘
Backend ☁️:

Component	                     Tech
🖥️ Server	    -   Node.js + Express (same codebase, scaled)
🗄️ Database	-   PostgreSQL (production-grade, replaces SQLite)
☁️ Hosting	   -   AWS or GCP
📍 Location	   -   Geocoding, cell-tower triangulation
🚨 Processing  -   De-duplication, escalation engine

Frontend & Mobile 📱:

Platform	                      Tech
🌐 Web Dashboard   -  React + authentication + role-based access
📱 Responder App   -  React Native or Flutter
🗺️ Maps	        -  Mapbox or Google Maps
🔔 Push	           -  FCM/APNs notifications
💬 SMS	           -  Twilio















This is Bhavesh's First pull and push.
This is our first working prototype.
Bhavesh workflow setup complete.

omika
jivisha
