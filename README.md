Project-NETRI

## The problem:

In danger, you can't unlock your phone and tap through an app. 
Safety apps don't work when you need them most. 
Separate devices are one more thing to carry.

Every woman already carries a compact mirror. Nobody questions it.

## The Solution

A smart compact mirror. 
Triple-tap it and it silently sends your GPS location and distress alert to trusted contacts and responders. 
Works offline on basic cell signal. 
No internet needed.

## MVP - What We're Building First

Core features only:

Triple-tap to send emergency alert
Automatic GPS location tracking
SMS and data transmission (offline and online)
Real-time responder dashboard with map
Simple alert status (sent, received, dispatched)

Features coming later:

Voice activation
Silent recording
Mobile apps
Advanced filtering
112 ERSS integration

## Key Features: 

Instant activation (no phone unlock needed)
Works offline (GSM/SMS signal, no data required)
Sends live GPS location to responders
Smart filtering (real emergency vs accidental bump)
Real-time responder dashboard with map tracking
Multiple alert channels (SMS and web)

## How It Works:

You tap -> Location sent -> Responders alerted -> Live dispatch

Online: Cellular data or BLE -> HTTPS API -> Backend -> Dashboard

Offline: GSM/SMS -> SMS Gateway -> Backend -> Dashboard

## Tech Stack:
Phase 1 - Prototype

Device simulator     :    HTML/CSS/JS + browser Geolocation 
Backend              :    Node.js, Express, Socket.io, SQLite 
Dashboard            :    HTML/CSS/JS, Leaflet, OpenStreetMap 
Transport            :    HTTP POST over WiFi

Phase 2 - Production

Hardware     :     ESP32, accelerometer, MEMS mic, GSM module, LiPo battery 
Firmware     :     C/C++ (Arduino/ESP-IDF) with tap detection 
Backend      :     Node.js, Express, PostgreSQL, AWS/GCP 
Frontend     :     React dashboard, React Native/Flutter mobile apps 
Connectivity :     GSM/SMS (offline) and cellular/BLE (online) 
SMS          :     Twilio 
Integration  :     112 ERSS API, WebSockets, FCM/APNs

## Target Users:
Women commuting alone
Students and young professionals
Women in high-risk professions
Anyone concerned about personal safety
Law enforcement and emergency responders

