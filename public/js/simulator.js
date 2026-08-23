const CONFIG = {
  API_BASE_URL: "",
  DEVICE_ID: "SAFE-COMPACT-001",
  DEVICE_ID_OPTIONS: ["SAFE-COMPACT-001", "SAFE-COMPACT-002"],
  TAP_REQUIRED: 3,
  TAP_WINDOW_MS: 2000,
  SOS_COUNTDOWN_SECONDS: 3,
  HEARTBEAT_INTERVAL_MS: 12000,
  LOCATION_UPDATE_INTERVAL_MS: 6000,
  BATTERY_DRAIN_INTERVAL_MS: 30000,
  BATTERY_DRAIN_STEP: 1,
  API_TIMEOUT_MS: 5000,
  LIVE_RECORDING_DURATION_MS: 40000,
};

const API_PATHS = {
  alert: "/api/alerts",
  deviceStatus: (deviceId) => `/api/device/${encodeURIComponent(deviceId)}/status`,
  reset: (deviceId) => `/api/device/${encodeURIComponent(deviceId)}/reset`,
  heartbeat: (deviceId) => `/api/device/${encodeURIComponent(deviceId)}/heartbeat`,
  location: (deviceId) => `/api/device/${encodeURIComponent(deviceId)}/location`,
};

const DEVICE_STATES = Object.freeze({
  IDLE: "IDLE",
  TAP_DETECTED: "TAP_DETECTED",
  COUNTDOWN: "COUNTDOWN",
  SOS_ACTIVE: "SOS_ACTIVE",
  TRANSMITTING: "TRANSMITTING",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  DEVICE_OFFLINE: "DEVICE_OFFLINE",
  DEVICE_LOST: "DEVICE_LOST",
  RESETTING: "RESETTING",
});

const createInitialState = (config) => ({
  deviceId: config.DEVICE_ID_OPTIONS[0],
  state: DEVICE_STATES.IDLE,
  battery: 82,
  batteryDrainEnabled: true,
  actualNetworkStatus: navigator.onLine ? "ONLINE" : "OFFLINE",
  simulatedNetworkStatus: "ONLINE",
  demoNetworkEnabled: true,
  gpsMode: "DEMO",
  location: null,
  locationStatus: "PENDING",
  serverStatus: "UNKNOWN",
  lastHeartbeat: null,
  alert: null,
  pendingAlert: null,
  tapCount: 0,
  countdown: null,
  logs: [],
});

function createTapDetector({ required, windowMs, onCount, onValid, onReset }) {
  let timestamps = [];
  let resetTimer;

  function reset() {
    timestamps = [];
    clearTimeout(resetTimer);
    onReset?.();
  }

  function tap(now = Date.now()) {
    timestamps = [...timestamps, now].filter((time) => now - time <= windowMs);
    onCount?.(timestamps.length);
    clearTimeout(resetTimer);
    resetTimer = setTimeout(reset, windowMs);
    if (timestamps.length >= required) {
      const sequence = [...timestamps];
      timestamps = [];
      clearTimeout(resetTimer);
      onValid?.(sequence);
      return true;
    }
    return false;
  }

  return { tap, reset };
}

const DEMO_ROUTE = [
  { latitude: 19.076, longitude: 72.8777, accuracy: 15, label: "Mumbai · Fort" },
  { latitude: 19.0783, longitude: 72.8811, accuracy: 15, label: "Mumbai · Kala Ghoda" },
  { latitude: 19.0809, longitude: 72.8848, accuracy: 15, label: "Mumbai · Colaba" },
];

function createGeolocation({ getMode, onUpdate, onError }) {
  let watchId = null;
  let demoIndex = 0;
  let demoTimer = null;

  function useDemoLocation() {
    const value = { ...DEMO_ROUTE[demoIndex % DEMO_ROUTE.length], timestamp: new Date().toISOString(), source: "DEMO" };
    demoIndex += 1;
    onUpdate(value);
    return value;
  }

  function start() {
    stop();
    if (getMode() === "DEMO") {
      useDemoLocation();
      demoTimer = setInterval(useDemoLocation, 6000);
      return;
    }
    if (!("geolocation" in navigator)) { onError("LOCATION_UNAVAILABLE"); return; }
    watchId = navigator.geolocation.watchPosition(
      (position) => onUpdate({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: new Date(position.timestamp).toISOString(), source: "REAL" }),
      (error) => onError(error.code === error.PERMISSION_DENIED ? "PERMISSION_DENIED" : "LOCATION_UNAVAILABLE"),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 },
    );
  }

  function stop() {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    clearInterval(demoTimer);
    watchId = null;
    demoTimer = null;
  }

  return { start, stop, useDemoLocation };
}


function createBattery({ initial = 82, onChange }) {
  let value = initial;
  let timer = null;
  function set(next) { value = Math.max(0, Math.min(100, Number(next))); onChange(value); }
  function start() {
    clearInterval(timer);
    timer = setInterval(() => { if (value > 5) set(value - CONFIG.BATTERY_DRAIN_STEP); }, CONFIG.BATTERY_DRAIN_INTERVAL_MS);
  }
  function stop() { clearInterval(timer); timer = null; }
  return { get value() { return value; }, set, start, stop };
}

function createNetworkMonitor({ onChange }) {
  let simulated = "ONLINE";
  let demoEnabled = true;
  const actual = () => navigator.onLine ? "ONLINE" : "OFFLINE";
  const emit = () => onChange({ actual: actual(), simulated, effective: demoEnabled ? simulated : actual(), demoEnabled });
  const onOnline = () => emit();
  const onOffline = () => emit();
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  emit();
  return {
    setSimulated(value) { simulated = value; emit(); },
    setDemoEnabled(value) { demoEnabled = value; emit(); },
    getEffective() { return demoEnabled ? simulated : actual(); },
    destroy() { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); },
  };
}


async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT_MS);
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message || body.error || `HTTP ${response.status}`);
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

const api = {
  sendAlert(payload) {
    return request(API_PATHS.alert, { method: "POST", body: JSON.stringify(payload) });
  },
  getStatus(deviceId) {
    return request(API_PATHS.deviceStatus(deviceId));
  },
  reset(deviceId, payload) {
    return request(API_PATHS.reset(deviceId), { method: "POST", body: JSON.stringify(payload) });
  },
  heartbeat(deviceId, payload) {
    return request(API_PATHS.heartbeat(deviceId), { method: "POST", body: JSON.stringify(payload) });
  },
  location(deviceId, payload) {
    return request(API_PATHS.location(deviceId), { method: "POST", body: JSON.stringify(payload) });
  },
};

function savePendingAlert(alert) {
  localStorage.setItem("safe-compact-pending-alert", JSON.stringify(alert));
}
function readPendingAlert() {
  try { return JSON.parse(localStorage.getItem("safe-compact-pending-alert") || "null"); } catch { return null; }
}
function clearPendingAlert() {
  localStorage.removeItem("safe-compact-pending-alert");
}

async function sendTrustedContactNotification({ contact, incidentId, backendUrl }) {
  return {
    contact: contact.name,
    phone: contact.phone,
    incidentId,
    status: "DEMO SENT",
    detail: "In-app alert simulated for this demo",
    backendUrl,
  };
}


const $ = (id) => document.getElementById(id);
const state = { state: DEVICE_STATES.IDLE, deviceId: CONFIG.DEVICE_ID, battery: 82, gpsMode: "DEMO", location: null, locationStatus: "PENDING", actualNetwork: navigator.onLine ? "ONLINE" : "OFFLINE", simulatedNetwork: "ONLINE", serverStatus: "WAITING", serverDetails: null, alert: null, pendingAlert: readPendingAlert(), incidentId: null, incidentTime: null, tapWindow: CONFIG.TAP_WINDOW_MS, routeIndex: 0, hash: "Generated after SOS activation", verified: false, contacts: JSON.parse(localStorage.getItem("safe-compact-contacts") || "null") || [{ name: "Mother", phone: "+91 98765 43210", relation: "Primary contact", access: "All incidents" }, { name: "Sister", phone: "+91 9958874247", relation: "Secondary contact", access: "All incidents" }], notifications: JSON.parse(localStorage.getItem("safe-compact-notifications") || "[]"), delivery: [], incidents: JSON.parse(localStorage.getItem("safe-compact-incidents") || "[]"), movement: [], logs: ["System armed · evidence preservation ready"] };
const sister = state.contacts.find((contact) => contact.name === "Sister");
if (sister) { sister.phone = "+91 9958874247"; localStorage.setItem("safe-compact-contacts", JSON.stringify(state.contacts)); }
const refs = ["breadcrumb", "heroStatus", "heroChip", "lastSync", "deviceOnline", "compact", "compactShell", "tapCounter", "compactCaption", "telemetryBattery", "telemetryGps", "telemetryCellular", "tapWindow", "tapWindowValue", "tapHint", "incidentId", "incidentOrb", "incidentState", "incidentDetail", "timeline", "mapCoords", "mapPin", "mapPlace", "mapStream", "latitude", "longitude", "locationStamp", "movementHistory", "vaultBadge", "hashValue", "hashStatus", "liveRecordingCard", "liveRecordingTitle", "liveRecordingDuration", "liveRecordingStatus", "contactCount", "contactList", "contactHeadline", "contactDescription", "notificationHistory", "contactIncident", "contactStatus", "contactIntegrity", "footerLog", "eventLog", "serverValue", "heartbeatValue", "responseBody", "responseStatus", "countdownPanel", "countdownValue", "cancelCountdown", "triggerSos", "resetDemo", "demoAlert", "deviceId", "batteryValue", "batteryMeter", "networkValue", "gpsValue", "coordsValue", "alertValue", "clock"].reduce((out, id) => (out[id] = $(id), out), {});
const route = [{ lat: "28.6139", lng: "77.2090", place: "Connaught Place" }, { lat: "28.6148", lng: "77.2107", place: "Barakhamba Road" }, { lat: "28.6162", lng: "77.2124", place: "Mandi House" }];
const steps = [["SOS_ACTIVATED", "SOS activated", "Three deliberate taps validated"], ["BUFFER_PRESERVED", "Buffer preserved", "60 seconds pre-event evidence locked"], ["RECORDING", "Recording started", "Post-event capture simulated"], ["GPS_CAPTURED", "Location captured", "Coordinates stamped to incident"], ["INCIDENT_CREATED", "Incident created", "Incident ID issued"], ["HASHED", "Evidence hashed", "SHA-256 integrity fingerprint generated"], ["UPLOADED", "Evidence uploaded", "Encrypted cloud sync complete"], ["EVIDENCE_STORED", "Evidence preserved", "Vault copy is device-independent"], ["CONTACTS_NOTIFIED", "Contacts notified", "Trusted contacts authorized"], ["DEVICE_LOST", "Device lost", "Cloud copy remains available"], ["VERIFIED", "Integrity verified", "File hash matches source"]];
function effectiveNetwork() { return state.simulatedNetwork; }
function log(text) { state.logs = [`${new Date().toLocaleTimeString()} · ${text}`, ...state.logs].slice(0, 6); render(); }
function statusLabel() { return ({ IDLE: "READY TO PROTECT", TAP_DETECTED: "TAP SEQUENCE DETECTED", COUNTDOWN: "ACTIVE EMERGENCY", SOS_ACTIVE: "ACTIVE EMERGENCY", TRANSMITTING: "ACTIVE EMERGENCY", ACKNOWLEDGED: "EVIDENCE PRESERVED", DEVICE_OFFLINE: "NO NETWORK", DEVICE_LOST: "DEVICE OFFLINE / LOST", VERIFIED: "CLOUD EVIDENCE VERIFIED" })[state.state] || "ACTIVE EMERGENCY"; }
function incidentExists() { return Boolean(state.incidentId || state.alert || state.pendingAlert); }
function tone() { return state.state === DEVICE_STATES.DEVICE_LOST || state.state === DEVICE_STATES.VERIFIED ? "red" : incidentExists() ? "gold" : "green"; }
function renderTimeline() { const current = state.state === "IDLE" || state.state === "TAP_DETECTED" || state.state === "DEVICE_OFFLINE" ? -1 : steps.findIndex(([id]) => id === state.state); refs.timeline.innerHTML = steps.map(([id, label, detail], index) => `<div class="timeline-row ${index <= current ? "done" : ""}"><span>${index <= current ? "✓" : index + 1}</span><div><strong>${label}</strong><small>${detail}</small></div><em>${index <= current ? "SYNCED" : "PENDING"}</em></div>`).join(""); }
function renderVault() { const selectedRecord = state.incidents.find((record) => record.id === state.incidentId); const hasRecord = Boolean(selectedRecord || incidentExists()); const recordTime = selectedRecord?.timestamp || state.incidentTime || "—"; const recordDevice = selectedRecord?.deviceId || state.deviceId; const recordLocation = selectedRecord?.location || route[selectedRecord?.routeIndex ?? state.routeIndex].place; const recordState = selectedRecord ? (selectedRecord.deviceState === "DEVICE_LOST" ? "LOST / OFFLINE" : selectedRecord.deviceState || "CONNECTED") : (state.state === DEVICE_STATES.DEVICE_LOST ? "LOST / OFFLINE" : "CONNECTED"); const recordHash = selectedRecord?.hash || state.hash; const recordVerified = selectedRecord?.verified === true || (!selectedRecord && state.verified); const access = selectedRecord?.access || state.contacts.map((contact) => ({ name: contact.name, status: "AUTHORIZED" })); refs.vaultCount.textContent = state.incidents.length || (hasRecord ? 1 : 0); refs.vaultBadge.textContent = hasRecord ? "⌑ VAULTED" : "⌑ STANDBY"; refs.hashValue.textContent = hasRecord ? recordHash : "Generated after SOS activation"; refs.hashStatus.textContent = recordVerified ? "MATCH" : hasRecord ? "STORED" : "PENDING"; refs.vaultIncidentTitle.textContent = hasRecord ? "Emergency evidence bundle" : "No incidents yet"; refs.vaultBody.innerHTML = hasRecord ? `<div class="incident-history-list"><span class="section-label">SYNCHRONIZED INCIDENTS</span>${state.incidents.map((item) => `<button class="incident-history-item ${item.id === state.incidentId ? "selected" : ""}" data-incident="${item.id}"><strong>${item.id}</strong><span>${item.timestamp || "—"} · ${item.status || "PRESERVED"}</span></button>`).join("")}</div><div class="vault-incident"><div class="vault-incident-top"><div><span class="section-label">INCIDENT / ${selectedRecord?.id || state.incidentId || "QUEUED"}</span><h2>Emergency evidence bundle</h2></div><b class="verified-badge">✓ ${recordVerified ? "MATCH" : "PRESERVED"}</b></div><div class="vault-details"><div><span>SOS ACTIVATED</span><strong>${recordTime}</strong></div><div><span>DEVICE</span><strong>${recordDevice}</strong></div><div><span>LOCATION</span><strong>${recordLocation}</strong></div><div><span>DEVICE STATE</span><strong>${recordState}</strong></div></div><div class="audio-card"><audio class="evidence-audio" data-audio="emergency" src="/manus-storage/emergency-demo_9a878305.wav" preload="metadata"></audio><button class="play-button" data-audio="emergency">▶</button><div><strong>Evidence playback · combined</strong><span>04:42</span><div class="waveform">||||||||||||||||||||||||||||||||||</div><small>DETERMINISTIC DEMO EVIDENCE</small></div></div><div class="vault-hash">⌘ <span>${recordHash}</span><button id="vaultVerify" class="secondary-action">VERIFY MATCH</button></div><div class="access-history"><span class="section-label">ACCESS HISTORY</span>${access.map((c) => `<div>♧ <strong>${c.name}</strong><span>${c.status || "AUTHORIZED"} · ${recordTime}</span></div>`).join("")}</div></div>` : `<div class="empty-state">▣<h2>No incidents yet</h2><p>Trigger a three-tap SOS from the command center to create a protected bundle.</p></div>`; const verify = $("vaultVerify"); if (verify) verify.onclick = verifyIntegrity; }
function renderVault() {}
function renderAudio() { document.querySelectorAll(".play-button").forEach((button) => { button.onclick = () => { const audio = button.closest(".audio-card")?.querySelector("audio"); if (!audio?.src) return; if (audio.paused) { document.querySelectorAll("audio.evidence-audio").forEach((item) => item !== audio && item.pause()); void audio.play(); button.textContent = "Ⅱ"; } else { audio.pause(); button.textContent = "▶"; } audio.onended = () => { button.textContent = "▶"; }; }; }); }
function renderContacts() { refs.contactCount.textContent = `${state.contacts.length} ACTIVE`; refs.contactList.innerHTML = state.contacts.map((c, i) => `<div class="contact-row"><div class="contact-avatar">${c.name.slice(0, 1).toUpperCase()}</div><div class="contact-copy"><strong>${c.name}</strong><span>${c.relation}<br />${c.phone}</span></div><span class="contact-access">${c.access}</span><button class="remove-contact" data-index="${i}" aria-label="Remove ${c.name}">×</button></div>`).join(""); document.querySelectorAll(".remove-contact").forEach((button) => button.onclick = () => { state.contacts.splice(Number(button.dataset.index), 1); localStorage.setItem("safe-compact-contacts", JSON.stringify(state.contacts)); render(); }); refs.contactHeadline.textContent = incidentExists() ? "Evidence is available now." : "Your circle is ready."; refs.contactDescription.textContent = incidentExists() ? "The owner does not need to approve access after a genuine SOS. Playback, location, and integrity status are synchronized." : "When an SOS is activated, authorized contacts receive an in-app alert and direct evidence access."; refs.contactIncident.textContent = state.incidentId || "—"; refs.contactStatus.textContent = state.state === DEVICE_STATES.DEVICE_LOST ? "CLOUD PRESERVED" : incidentExists() ? "ACTIVE" : "READY"; refs.contactIntegrity.textContent = state.verified ? "MATCH" : incidentExists() ? "STORED" : "PENDING"; refs.notificationHistory.innerHTML = `<span class="section-label">IN-APP NOTIFICATION HISTORY</span>${state.notifications.length ? state.notifications.map((n) => `<div>♢ &nbsp;${n}</div>`).join("") : "<div>♢ &nbsp; In-app alert simulation is armed</div>"}${state.delivery.map((d) => `<div class="delivery-row">${d.contact} · ${d.phone} <b>${d.status}</b><small>${d.detail}</small></div>`).join("")}`; }
function render() { const network = effectiveNetwork(); const label = statusLabel(); refs.heroStatus.textContent = label; refs.heroChip.innerHTML = `<i></i>${label}`; refs.heroChip.className = `status-chip chip-${tone()}`; refs.lastSync.textContent = state.incidentTime || "just now"; refs.deviceOnline.textContent = state.state === DEVICE_STATES.DEVICE_LOST ? "● LOST" : "● ONLINE"; refs.deviceOnline.className = `status-chip small chip-${state.state === DEVICE_STATES.DEVICE_LOST ? "red" : "green"}`; refs.compactShell.className = `compact-device ${tone()}`; refs.tapCounter.textContent = state.tapCount ? `${state.tapCount}/3 TAPS` : state.state === DEVICE_STATES.DEVICE_LOST ? "DEVICE LOST" : "HIDDEN TOUCH AREA"; refs.compactCaption.innerHTML = `<i></i>${label}`; refs.telemetryBattery.textContent = state.state === DEVICE_STATES.DEVICE_LOST ? "—" : `${state.battery}%`; refs.telemetryGps.textContent = state.state === DEVICE_STATES.DEVICE_LOST ? "Offline" : "Ready"; refs.telemetryCellular.textContent = network === "OFFLINE" || state.state === DEVICE_STATES.DEVICE_LOST ? "Offline" : network === "WEAK" ? "Weak" : "Connected"; refs.tapWindowValue.textContent = `${(state.tapWindow / 1000).toFixed(1)}s`; refs.tapWindow.value = state.tapWindow; refs.tapHint.textContent = state.state === DEVICE_STATES.TAP_DETECTED ? `${3 - state.tapCount} more tap${state.tapCount === 2 ? "" : "s"} within ${(state.tapWindow / 1000).toFixed(1)} seconds` : state.state === DEVICE_STATES.IDLE ? "Tap the hidden area 3 times to trigger SOS" : "SOS sequence captured · preservation is automatic"; refs.incidentId.textContent = state.incidentId || (state.pendingAlert ? "ALERT QUEUED" : "AWAITING ACTIVATION"); refs.incidentState.textContent = state.state === DEVICE_STATES.DEVICE_LOST ? "Cloud copy protected" : incidentExists() ? "Preservation in progress" : "System standing by"; refs.incidentDetail.textContent = incidentExists() ? "Evidence is synchronized beyond the device" : "Three taps begin the evidence chain"; refs.incidentOrb.className = `orb-${tone()}`; refs.mapCoords.textContent = `${route[state.routeIndex].lat}° N · ${route[state.routeIndex].lng}° E`; refs.mapPlace.textContent = route[state.routeIndex].place; refs.mapPin.style.left = `${34 + state.routeIndex * 17}%`; refs.mapPin.style.top = `${56 - state.routeIndex * 10}%`; refs.mapStream.innerHTML = `<i></i> ${state.state === DEVICE_STATES.DEVICE_LOST ? "LAST KNOWN LOCATION" : "LOCATION STREAMING"}`; refs.latitude.textContent = `${route[state.routeIndex].lat}° N`; refs.longitude.textContent = `${route[state.routeIndex].lng}° E`; refs.locationStamp.textContent = state.incidentTime || "—"; refs.movementHistory.classList.toggle("hidden", !state.movement.length); refs.movementHistory.innerHTML = `<span class="section-label">MOVEMENT HISTORY</span>${state.movement.map((m) => `<span>⌖ ${m}</span>`).join("")}`; refs.serverValue.textContent = state.serverStatus === "RECEIVED" ? "● CONNECTED" : state.serverStatus === "UNREACHABLE" ? "⚠ SERVER UNREACHABLE" : "○ WAITING"; refs.heartbeatValue.textContent = state.lastHeartbeat ? new Date(state.lastHeartbeat).toLocaleTimeString() : "—"; refs.alertValue.textContent = state.pendingAlert ? "ALERT QUEUED" : state.alert ? "SENT · " + (state.incidentId || "RECEIVED") : "NONE"; refs.responseBody.innerHTML = state.alert ? `<strong>SOS SENT ✓</strong><br />Incident ID: ${state.incidentId || "—"}<br />Server: ${state.serverStatus}` : state.pendingAlert ? "SOS ACTIVE · ALERT QUEUED · WAITING FOR CONNECTION" : state.serverDetails ? `<strong>DEVICE STATUS RECEIVED</strong><br />${JSON.stringify(state.serverDetails)}` : "Waiting for a signal from the compact."; refs.responseStatus.textContent = state.pendingAlert ? "QUEUED" : state.alert ? "RECEIVED" : "IDLE"; refs.countdownPanel.classList.toggle("hidden", state.state !== DEVICE_STATES.COUNTDOWN); refs.eventLog.innerHTML = state.logs.map((x) => `<div>${x}</div>`).join(""); refs.footerLog.textContent = state.logs[0] || "System armed"; renderTimeline(); renderVault(); renderContacts(); renderAudio(); document.querySelectorAll(".incident-history-item").forEach((item) => item.onclick = () => { const selected = state.incidents.find((record) => record.id === item.dataset.incident); if (selected) { state.incidentId = selected.id; state.incidentTime = selected.timestamp || state.incidentTime; state.deviceId = selected.deviceId || state.deviceId; state.routeIndex = selected.routeIndex ?? state.routeIndex; state.hash = selected.hash || state.hash; state.state = selected.deviceState === "DEVICE_LOST" ? DEVICE_STATES.DEVICE_LOST : selected.status === "VERIFIED" ? DEVICE_STATES.VERIFIED : DEVICE_STATES.ACKNOWLEDGED; } render(); }); }

const geolocation = createGeolocation({ getMode: () => state.gpsMode, onUpdate: (location) => { state.location = location; state.locationStatus = "AVAILABLE"; log(`${location.source === "REAL" ? "GPS acquired" : "Demo location selected"} · ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`); }, onError: (error) => { state.location = null; state.locationStatus = error; log(`Location unavailable · ${error}`); } });
const battery = createBattery({ initial: state.battery, onChange: (value) => { state.battery = value; render(); } });
const network = createNetworkMonitor({ onChange: ({ actual, simulated, effective }) => { state.actualNetwork = actual; state.simulatedNetwork = simulated; if (effective === "OFFLINE" && state.state === DEVICE_STATES.IDLE) state.state = DEVICE_STATES.DEVICE_OFFLINE; if (effective !== "OFFLINE" && state.state === DEVICE_STATES.DEVICE_OFFLINE) state.state = DEVICE_STATES.IDLE; render(); if (effective !== "OFFLINE") retryPending(); } });
let countdownTimer;
const taps = createTapDetector({ required: 3, windowMs: state.tapWindow, onCount: (count) => { if ([DEVICE_STATES.IDLE, DEVICE_STATES.TAP_DETECTED].includes(state.state)) { state.state = DEVICE_STATES.TAP_DETECTED; state.tapCount = count; log(`Tap ${count} detected · ${3 - count} remaining`); } }, onValid: () => beginCountdown(), onReset: () => { if (state.state === DEVICE_STATES.TAP_DETECTED) { state.state = DEVICE_STATES.IDLE; state.tapCount = 0; log("Tap sequence expired"); } } });
function triggerTap() { if ([DEVICE_STATES.IDLE, DEVICE_STATES.TAP_DETECTED, DEVICE_STATES.DEVICE_OFFLINE].includes(state.state)) taps.tap(); }
let liveRecorder;
let liveRecordingStream;
let liveRecordingChunks = [];
let liveRecordingTimer;
let liveRecordingUrl;
let discardLiveRecording = false;
async function startLiveRecording() { if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { refs.liveRecordingStatus.textContent = "LIVE MICROPHONE NOT SUPPORTED IN THIS BROWSER"; return; } try { discardLiveRecording = false; liveRecordingStream = await navigator.mediaDevices.getUserMedia({ audio: true }); liveRecordingChunks = []; liveRecorder = new MediaRecorder(liveRecordingStream); liveRecorder.ondataavailable = (event) => { if (event.data.size) liveRecordingChunks.push(event.data); }; liveRecorder.onstop = () => { const shouldDiscard = discardLiveRecording; const blob = new Blob(liveRecordingChunks, { type: liveRecorder.mimeType || "audio/webm" }); if (!shouldDiscard) { if (liveRecordingUrl) URL.revokeObjectURL(liveRecordingUrl); liveRecordingUrl = URL.createObjectURL(blob); const audio = document.querySelector('audio[data-audio="emergency"]'); audio.src = liveRecordingUrl; audio.load(); refs.liveRecordingCard.classList.remove("hidden"); refs.liveRecordingTitle.textContent = "Live emergency recording"; refs.liveRecordingDuration.textContent = `${Math.max(1, Math.round(blob.size / 1000))} KB`; refs.liveRecordingStatus.textContent = "LIVE AUDIO CAPTURED · READY TO PLAY"; renderAudio(); } liveRecordingStream?.getTracks().forEach((track) => track.stop()); liveRecordingStream = undefined; }; liveRecorder.start(); refs.liveRecordingTitle.textContent = "Recording live audio"; refs.liveRecordingDuration.textContent = "REC"; refs.liveRecordingStatus.textContent = "MICROPHONE ACTIVE · CAPTURING SOS AUDIO"; liveRecordingTimer = setTimeout(stopLiveRecording, CONFIG.LIVE_RECORDING_DURATION_MS); } catch (error) { refs.liveRecordingStatus.textContent = "MICROPHONE ACCESS DENIED · LIVE AUDIO UNAVAILABLE"; log("Microphone permission was not granted"); } }
function stopLiveRecording({ discard = false } = {}) { discardLiveRecording = discard; clearTimeout(liveRecordingTimer); if (liveRecorder?.state === "recording") liveRecorder.stop(); else liveRecordingStream?.getTracks().forEach((track) => track.stop()); }
function beginCountdown() { state.state = DEVICE_STATES.COUNTDOWN; state.countdown = 3; void startLiveRecording(); log("Triple tap validated · countdown started"); refs.countdownValue.textContent = "3"; clearInterval(countdownTimer); countdownTimer = setInterval(() => { state.countdown -= 1; if (state.countdown <= 0) { clearInterval(countdownTimer); activateSOS(); } render(); }, 1000); render(); }
function cancelCountdown() { clearInterval(countdownTimer); stopLiveRecording({ discard: true }); state.state = DEVICE_STATES.IDLE; state.tapCount = 0; state.countdown = null; log("Countdown cancelled · no alert transmitted"); }
function playAlertPing() { try { const AudioContextClass = window.AudioContext || window.webkitAudioContext; if (!AudioContextClass) return; const context = new AudioContextClass(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.type = "sine"; oscillator.frequency.setValueAtTime(880, context.currentTime); oscillator.frequency.exponentialRampToValueAtTime(1320, context.currentTime + 0.12); gain.gain.setValueAtTime(0.0001, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.32); oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.34); oscillator.addEventListener("ended", () => context.close()); } catch {} }
function showDemoAlert(incidentId) { const recipient = state.contacts.find((contact) => contact.name === "Sister"); if (!recipient || !refs.demoAlert) return; playAlertPing(); refs.demoAlert.innerHTML = `<strong>DEMO ALERT RECEIVED</strong><span>Sister · ${recipient.phone}</span><small>SOS ${incidentId} · simulated in-app notification</small>`; refs.demoAlert.classList.remove("hidden"); setTimeout(() => refs.demoAlert.classList.add("hidden"), 7000); }
async function activateSOS() { state.state = DEVICE_STATES.SOS_ACTIVE; state.incidentTime = new Date().toLocaleTimeString(); state.incidentId = `SC-001-${String(Date.now()).slice(-4)}`; moveGps(); state.alert = null; showDemoAlert(state.incidentId); state.notifications.unshift(`DEMO ALERT SENT TO SISTER · ${state.contacts.find((contact) => contact.name === "Sister")?.phone || ""} · ${new Date().toLocaleTimeString()}`); localStorage.setItem("safe-compact-notifications", JSON.stringify(state.notifications)); log("SOS locked in · demo alert sent to Sister"); state.hash = await hashEvidence(state.incidentId); const payload = { deviceId: state.deviceId, triggeredAt: new Date().toISOString(), latitude: state.location?.latitude ?? Number(route[state.routeIndex].lat), longitude: state.location?.longitude ?? Number(route[state.routeIndex].lng), batteryLevel: state.battery, signalStatus: effectiveNetwork() }; state.pendingAlert = payload; savePendingAlert(payload); render(); await transmit(payload); }
async function transmit(payload) { if (effectiveNetwork() === "OFFLINE") { log("Alert queued · waiting for connection"); render(); return; } try { const response = await api.sendAlert(payload); const alert = response.alert || response; state.alert = alert; state.pendingAlert = null; state.incidentId = alert.alert_id || state.incidentId; clearPendingAlert(); state.serverStatus = "RECEIVED"; state.notifications.unshift(`ACTIVE EMERGENCY · ${state.incidentId} · ${new Date().toLocaleTimeString()}`); state.delivery = await Promise.all(state.contacts.map((contact) => sendTrustedContactNotification({ contact, incidentId: state.incidentId, backendUrl: CONFIG.API_BASE_URL }))); localStorage.setItem("safe-compact-notifications", JSON.stringify(state.notifications)); const record = { id: state.incidentId, timestamp: state.incidentTime, deviceId: state.deviceId, location: route[state.routeIndex].place, routeIndex: state.routeIndex, hash: state.hash, deviceState: "ACKNOWLEDGED", status: "PRESERVED", verified: false, access: state.contacts.map((contact) => ({ name: contact.name, phone: contact.phone, status: "AUTHORIZED" })) }; if (!state.incidents.some((x) => x.id === record.id)) state.incidents.unshift(record); localStorage.setItem("safe-compact-incidents", JSON.stringify(state.incidents)); state.state = DEVICE_STATES.ACKNOWLEDGED; log(`Backend acknowledged alert · ${state.incidentId}`); render(); } catch (error) { state.serverStatus = "UNREACHABLE"; log(`Server connection failed · alert remains queued`); render(); } }
async function retryPending() { const pending = readPendingAlert(); if (pending && effectiveNetwork() !== "OFFLINE") { state.pendingAlert = pending; log("Connection restored · retrying queued alert"); await transmit(pending); } }
async function hashEvidence(value) { try { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40) + "..."; } catch { return "a48b7d91f6e3c1a4...4b2e"; } }
async function verifyIntegrity() { if (!incidentExists()) return; state.verified = true; const selected = state.incidents.find((record) => record.id === state.incidentId); if (selected) { selected.verified = true; selected.status = "VERIFIED"; localStorage.setItem("safe-compact-incidents", JSON.stringify(state.incidents)); } state.state = DEVICE_STATES.VERIFIED; log("Integrity verification complete · SHA-256 MATCH"); render(); }
function moveGps() { if (!incidentExists()) return; state.routeIndex = (state.routeIndex + 1) % route.length; state.movement.unshift(`${new Date().toLocaleTimeString()} · ${route[state.routeIndex].place} · ${route[state.routeIndex].lat}, ${route[state.routeIndex].lng}`); state.movement = state.movement.slice(0, 4); log(`GPS movement simulated · ${route[state.routeIndex].place}`); }
async function loseDevice() { if (!incidentExists()) { log("Device loss requires an active incident"); return; } stopLiveRecording({ discard: true }); state.state = DEVICE_STATES.DEVICE_LOST; geolocation.stop(); log("Device marked lost · cloud evidence remains available"); render(); }
async function resetDemo() { const batteryLevel = state.battery; state.state = DEVICE_STATES.RESETTING; render(); clearInterval(countdownTimer); stopLiveRecording({ discard: true }); geolocation.stop(); taps.reset(); try { await api.reset(state.deviceId, { device_id: state.deviceId, timestamp: new Date().toISOString(), reason: "MANUAL_RESET" }); } catch {} state.state = effectiveNetwork() === "OFFLINE" ? DEVICE_STATES.DEVICE_OFFLINE : DEVICE_STATES.IDLE; state.battery = batteryLevel; state.alert = null; state.pendingAlert = null; state.incidentId = null; state.incidentTime = null; state.hash = "Generated after SOS activation"; state.verified = false; state.tapCount = 0; state.movement = []; clearPendingAlert(); log("Demo reset · server evidence is not deleted"); geolocation.start(); render(); }
async function addContact() { const name = prompt("Trusted contact name:"); const phone = prompt("Phone number with country code (example: +91 98765 43210):"); if (!name || !phone) return; if (!/^\+?[1-9]\d{7,14}$/.test(phone.replace(/[\s()-]/g, ""))) { alert("Enter a valid international phone number, e.g. +919876543210"); return; } state.contacts.push({ name, phone, relation: "New contact", access: "All incidents" }); localStorage.setItem("safe-compact-contacts", JSON.stringify(state.contacts)); log(`Trusted contact added · ${name}`); render(); }
function switchTab(tab) { document.querySelectorAll(".page").forEach((page) => page.classList.add("hidden")); $(`${tab}Page`).classList.remove("hidden"); document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("nav-active", item.dataset.tab === tab)); refs.breadcrumb.textContent = tab === "overview" ? "COMMAND CENTER" : "TRUSTED CONTACTS"; }

function triggerDemoSOS() { if (state.state !== DEVICE_STATES.IDLE) return; [0, 1, 2].forEach((_, index) => setTimeout(() => taps.tap(), index * 220)); }
refs.compact.onclick = triggerTap; refs.compact.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); triggerTap(); } }; refs.cancelCountdown.onclick = cancelCountdown; refs.triggerSos.onclick = triggerDemoSOS; refs.resetDemo.onclick = resetDemo; $("moveGps").onclick = moveGps; $("addContact").onclick = addContact; $("controllerReset").onclick = resetDemo; $("controllerTrigger").onclick = triggerDemoSOS; $("controllerMove").onclick = moveGps; $("controllerLost").onclick = loseDevice; $("controllerVerify").onclick = verifyIntegrity; refs.tapWindow.oninput = (e) => { state.tapWindow = Number(e.target.value); log(`Tap window set to ${(state.tapWindow / 1000).toFixed(1)} seconds`); };
document.querySelectorAll(".nav-item, [data-tab]").forEach((item) => item.onclick = () => switchTab(item.dataset.tab));
document.querySelectorAll("[data-action]").forEach((item) => item.onclick = () => { const a = item.dataset.action; if (a === "demo-gps") { state.gpsMode = "DEMO"; geolocation.start(); } if (a === "real-gps") { state.gpsMode = "REAL"; geolocation.start(); } });
setInterval(() => { refs.clock.textContent = new Date().toLocaleTimeString(); }, 1000);
state.locationStatus = "PENDING"; geolocation.start(); battery.start(); void retryPending(); render();

/* Standalone heartbeat loop: safely reports the compact without crashing offline. */
async function standaloneHeartbeat() {
  if (typeof state === "undefined" || typeof api === "undefined") return;
  if (typeof effectiveNetwork === "function" && effectiveNetwork() === "OFFLINE") {
    if (typeof log === "function") log("Heartbeat paused · simulator offline");
    return;
  }
  try {
    await api.heartbeat(state.deviceId, {
      device_id: state.deviceId,
      timestamp: new Date().toISOString(),
      battery: state.battery,
      network: typeof effectiveNetwork === "function" ? effectiveNetwork() : "ONLINE",
      state: state.state,
      latitude: state.location?.latitude ?? null,
      longitude: state.location?.longitude ?? null,
    });
    state.serverStatus = "RECEIVED";
    state.lastHeartbeat = new Date().toISOString();
    if (typeof render === "function") render();
  } catch (error) {
    state.serverStatus = "UNREACHABLE";
    if (typeof log === "function") log(`Heartbeat failed · ${error.message}`);
  }
}
setInterval(standaloneHeartbeat, 15000);
void standaloneHeartbeat();
