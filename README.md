Project-NETRI

⚠️ The Problem:

In danger, you can't unlock your phone and tap through an app. 
Safety apps don't work when you need them most. 
Separate devices are one more thing to carry.

But compact mirrors? Every woman already has one. Nobody questions it.

✨ The Solution:

A smart compact mirror --> NETRI= Network for Emergency Threat Response and Intervention. Triple-tap it and it silently sends your GPS location and distress alert to trusted contacts and responders. 
Works offline on basic cell signal. 
No internet needed.

How to activate:
🔘 Triple-tap the mirror surface    →    instant alert
🎤 Say a word you chose             →    voice activation
🎬 Different tap pattern            →    starts recording for evidence

🎯 Key Features:
⚡ Instant activation      —    no phone unlock needed
📡 Works offline           —    GSM/SMS signal, no data required
📍 Live GPS location       —    responders know exactly where you are
🧠 Smart filtering         —    knows real emergency vs. accidental bump
🎙️ Silent recording mode   —    tap to record evidence
🗺️ Real-time dashboard     —    responders see your location live
📢 Multiple alert channels —    SMS, push notifications, web alerts

🔄 How It Works:

You tap 🔘 → Location sent 📍 → Responders alerted 🚨 → Live dispatch 🗺️

If online: Cellular data / BLE → HTTPS API → Backend → Dashboard
If offline: GSM/SMS → SMS Gateway → Backend → Dashboard

💻 Tech Stack:

🔬 Phase 1 (This Weekend) — Prototype:

💻 Device simulator   :   HTML/CSS/JS + browser Geolocation
🖥️ Backend            :   Node.js + Express, Socket.io, SQLite
🗺️ Dashboard          :   HTML/CSS/JS, Leaflet + OpenStreetMap
🌐 Transport          :   HTTP POST over WiFi

🏭 Phase 2 (Production) — Real Hardware:

🔧 Hardware        :   ESP32 + accelerometer + MEMS mic + GSM module + LiPo battery
📟 Firmware        :   C/C++ (Arduino/ESP-IDF) with on-device tap detection
☁️ Backend         :   Node.js + Express (scaled), PostgreSQL, AWS/GCP
📱 Fronte          :   React dashboard + React Native/Flutter mobile apps
📡 Connectivity    :   Dual-path (GSM/SMS offline + cellular/BLE online)
📞 SMS Gateway     :   Twilio
🔗 Integration     :   112 ERSS API, WebSockets, push notifications (FCM/APNs)


🥊 Why NETRI Wins
Factor	                   SafeCompact	          Safety Apps	          Smartwatches
⚡ Activation speed	     Tap (instant)	     Unlock + tap (3-5 sec)	    Hold + confirm
📡 Works offline	    ✅ Yes (GSM/SMS)	          ❌ No	                  ❌ No
👜 Form factor	          Always in hand	    Phone (obvious)	        Watch (30% wear)
🎬 Recording	          ✅ Built-in	          ❌ No	                  ❌ No
💰 Cost	                $60-80 + $2-5/mo	      $5-15/mo	            $200-500 device
🕵️ Unsuspicious	     ✅ Makeup mirror	  ❌ Security device	     ❌ Security device

👥 Target Users:

👩‍💼 Women commuting alone
🎓 Students and young professionals
💼 Women in high-risk professions (hospitality, gig work, delivery)
🌆 Anyone concerned about personal safety in public spaces
🚨 Law enforcement and emergency responders
🤝 Contributing
