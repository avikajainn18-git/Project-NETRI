/* =========================================================
   1. CONFIGURATION
   ========================================================= */
var CONFIG = {
  API_BASE_URL: window.location.origin,
  SOCKET_URL: window.location.origin
};

/* =========================================================
   2. ALERT DATA - loaded from backend, never hardcoded
   ========================================================= */
var alerts = [];
var selectedCaseId = null;
var markers = {};
var socket = null;

/* =========================================================
   3. MAP INITIALIZATION
   ========================================================= */
var map = L.map("map").setView([28.68, 77.17], 11);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "OpenStreetMap contributors"
}).addTo(map);

/* =========================================================
   4. BACKEND TO DASHBOARD FIELD MAPPING
   ========================================================= */
function mapStatus(backendStatus) {
  var m = {
    "ACTIVE": "Active",
    "ACKNOWLEDGED": "Acknowledged",
    "ESCALATED": "Escalated",
    "RESOLVED": "Resolved",
    "CANCELLED": "Cancelled"
  };
  return m[backendStatus] || backendStatus;
}

function formatTime(isoString) {
  if (!isoString) return "\u2014";
  try {
    var d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return isoString;
  }
}

function formatCoordinates(lat, lng) {
  if (lat == null || lng == null) return "No GPS";
  return lat.toFixed(4) + ", " + lng.toFixed(4);
}

function buildHistory(alert) {
  var steps = [];
  steps.push({ status: "SOS Triggered", time: formatTime(alert.triggered_at || alert.created_at) });
  steps.push({ status: "Alert Received", time: formatTime(alert.created_at) });
  if (alert.latitude != null && alert.longitude != null) {
    steps.push({ status: "Location Captured", time: formatTime(alert.created_at) });
  }
  if (alert.status === "ACKNOWLEDGED" || alert.status === "RESOLVED" || alert.status === "ESCALATED") {
    steps.push({ status: "Acknowledged", time: formatTime(alert.acknowledged_at) });
  }
  if (alert.status === "RESOLVED") {
    steps.push({ status: "Resolved", time: formatTime(alert.resolved_at) });
  }
  if (alert.status === "CANCELLED") {
    steps.push({ status: "Cancelled", time: formatTime(alert.resolved_at) });
  }
  if (alert.status === "ESCALATED") {
    steps.push({ status: "Escalated", time: "\u2014" });
  }
  return steps;
}

function buildEvidence(alert) {
  var items = [];
  items.push({ label: "Timestamp Recorded", done: Boolean(alert.created_at) });
  items.push({ label: "Location Captured", done: alert.latitude != null && alert.longitude != null });
  items.push({ label: "Battery Level: " + (alert.battery_level != null ? alert.battery_level + "%" : "Unknown"), done: alert.battery_level != null });
  return items;
}

function backendToDashboard(alert) {
  return {
    id: alert.alert_id,
    status: mapStatus(alert.status),
    location: formatCoordinates(alert.latitude, alert.longitude),
    lat: alert.latitude || 28.68,
    lng: alert.longitude || 77.17,
    time: formatTime(alert.triggered_at || alert.created_at),
    deviceId: alert.device_id,
    signalStatus: alert.signal_status || "Unknown",
    batteryLevel: alert.battery_level,
    createdAt: alert.created_at,
    triggeredAt: alert.triggered_at,
    acknowledgedAt: alert.acknowledged_at,
    resolvedAt: alert.resolved_at,
    backendStatus: alert.status,
    history: buildHistory(alert),
    evidence: buildEvidence(alert),
    recording: { available: false }
  };
}

/* =========================================================
   5. LOAD ALERTS FROM BACKEND
   ========================================================= */
async function loadAlertsFromAPI() {
  try {
    var response = await fetch(CONFIG.API_BASE_URL + "/api/alerts?limit=100");
    var data = await response.json();
    alerts = (data.alerts || []).map(backendToDashboard);
    if (alerts.length > 0 && !selectedCaseId) {
      selectedCaseId = alerts[0].id;
    }
    renderAll();
    console.log("[Dashboard] Loaded " + alerts.length + " alerts from API");
  } catch (err) {
    console.error("[Dashboard] Failed to load alerts:", err.message);
    alerts = [];
    renderAll();
  }
}

/* =========================================================
   6. SOCKET.IO - REAL-TIME EVENTS
   ========================================================= */
function connectSocket() {
  if (typeof io === 'undefined') {
    console.error('[Dashboard] Socket.IO client library not loaded. Real-time updates disabled.');
    return;
  }
  socket = io(CONFIG.SOCKET_URL, { reconnection: true, reconnectionDelay: 2000 });

  socket.on("connect", function () {
    console.log("[Dashboard] Socket.IO connected: " + socket.id);
  });

  socket.on("disconnect", function (reason) {
    console.log("[Dashboard] Socket.IO disconnected: " + reason);
  });

  socket.on("alert:created", function (data) {
    console.log("[Dashboard] alert:created - " + data.alert.alert_id);
    var dashboardAlert = backendToDashboard(data.alert);
    var exists = alerts.find(function (a) { return a.id === dashboardAlert.id; });
    if (!exists) {
      alerts.unshift(dashboardAlert);
    }
    if (!selectedCaseId) {
      selectedCaseId = dashboardAlert.id;
    }
    renderAll();
  });

  socket.on("alert:acknowledged", function (data) {
    console.log("[Dashboard] alert:acknowledged - " + data.alert.alert_id);
    updateAlertFromEvent(data.alert);
  });

  socket.on("alert:resolved", function (data) {
    console.log("[Dashboard] alert:resolved - " + data.alert.alert_id);
    updateAlertFromEvent(data.alert);
  });

  socket.on("alert:cancelled", function (data) {
    console.log("[Dashboard] alert:cancelled - " + data.alert.alert_id);
    updateAlertFromEvent(data.alert);
  });
}

function updateAlertFromEvent(backendAlert) {
  var updated = backendToDashboard(backendAlert);
  for (var i = 0; i < alerts.length; i++) {
    if (alerts[i].id === updated.id) {
      alerts[i] = updated;
      break;
    }
  }
  renderAll();
}

/* =========================================================
   7. MARKERS
   ========================================================= */
function renderMarkers() {
  Object.values(markers).forEach(function (m) {
    map.removeLayer(m);
  });
  markers = {};

  alerts.forEach(function (alert) {
    var color = "#c9a227";
    if (alert.status === "Escalated") color = "#e5484d";
    if (alert.status === "Resolved") color = "#4caf50";
    if (alert.status === "Cancelled") color = "#6c6270";
    if (alert.status === "Acknowledged") color = "#b9aec2";

    var isSelected = alert.id === selectedCaseId;

    var marker = L.circleMarker([alert.lat, alert.lng], {
      radius: isSelected ? 14 : 10,
      color: color,
      fillColor: color,
      fillOpacity: 0.85,
      weight: isSelected ? 4 : 2
    }).addTo(map);

    marker.bindTooltip(alert.id.substring(0, 8) + "\u2026");
    marker.on("click", function () {
      selectCase(alert.id);
    });

    markers[alert.id] = marker;
  });
}

/* =========================================================
   8. CASE LIST
   ========================================================= */
function renderCaseList() {
  var tbody = document.getElementById("case-list-body");
  tbody.innerHTML = "";

  alerts.forEach(function (alert) {
    var row = document.createElement("tr");
    row.className = alert.id === selectedCaseId ? "selected-row" : "";
    row.innerHTML =
      "<td>" + alert.id.substring(0, 8) + "\u2026</td>" +
      "<td><span class='status-chip status-" + alert.status + "'>" + alert.status + "</span></td>" +
      "<td>" + alert.location + "</td>" +
      "<td>" + alert.time + "</td>";

    row.addEventListener("click", function () {
      selectCase(alert.id);
    });

    tbody.appendChild(row);
  });
}

/* =========================================================
   9. CASE SELECTION
   ========================================================= */
function selectCase(id) {
  selectedCaseId = id;
  renderMarkers();
  renderCaseList();
  renderSelectedCase();
  renderRecording();
  renderEvidence();
  renderHistory();
  centerMapOnSelectedCase();
}

function getSelectedCase() {
  return alerts.find(function (a) {
    return a.id === selectedCaseId;
  });
}

/* =========================================================
   10. MAP CENTERING ON SELECTED CASE
   ========================================================= */
function centerMapOnSelectedCase() {
  var alert = getSelectedCase();
  if (!alert) return;
  if (alert.lat && alert.lng) {
    map.setView([alert.lat, alert.lng], 15);
  }
}

/* =========================================================
   11. SELECTED CASE (full incident details)
   ========================================================= */
function renderSelectedCase() {
  var alert = getSelectedCase();
  var title = document.getElementById("selected-case-title");
  var body = document.getElementById("selected-case-body");
  var resolveBtn = document.getElementById("resolve-btn");

  if (!alert) {
    title.textContent = "Selected Case";
    body.innerHTML = "<p>No alerts yet. Waiting for backend data\u2026</p>";
    resolveBtn.disabled = true;
    resolveBtn.textContent = "Resolve";
    return;
  }

  title.textContent = "Case " + alert.id.substring(0, 8) + "\u2026";

  body.innerHTML =
    "<div class='incident-grid'>" +
      field("Status", "<span class='status-chip status-" + alert.status + "'>" + alert.status + "</span>") +
      field("Device", alert.deviceId) +
      field("Signal", alert.signalStatus) +
      field("Battery", alert.batteryLevel != null ? alert.batteryLevel + "%" : "Unknown") +
      field("Location", alert.location) +
      field("Time", alert.time) +
      field("Coordinates", alert.lat + ", " + alert.lng) +
    "</div>";

  function field(label, value) {
    return "<div class='incident-field'><span class='field-label'>" + label + "</span>" + value + "</div>";
  }

  var isTerminal = alert.status === "Resolved" || alert.status === "Cancelled";
  resolveBtn.disabled = isTerminal;
  resolveBtn.textContent = isTerminal ? alert.status : "Resolve";
}

/* =========================================================
   12. RECORDING (placeholder)
   ========================================================= */
function renderRecording() {
  var statusEl = document.getElementById("recording-status");
  var playBtn = document.getElementById("play-recording-btn");
  statusEl.textContent = "No recording available";
  playBtn.disabled = true;
}

document.getElementById("play-recording-btn").addEventListener("click", function () {
  /* Placeholder - no audio from backend yet */
});

/* =========================================================
   13. EVIDENCE
   ========================================================= */
function renderEvidence() {
  var alert = getSelectedCase();
  var list = document.getElementById("evidence-list");
  list.innerHTML = "";

  if (!alert || !alert.evidence) return;

  alert.evidence.forEach(function (item) {
    var li = document.createElement("li");
    li.textContent = item.label;
    if (!item.done) li.classList.add("pending");
    list.appendChild(li);
  });
}

/* =========================================================
   14. INCIDENT HISTORY
   ========================================================= */
function renderHistory() {
  var alert = getSelectedCase();
  var list = document.getElementById("history-timeline");
  list.innerHTML = "";

  if (!alert) return;

  alert.history.forEach(function (step) {
    var li = document.createElement("li");
    li.innerHTML = step.status + "<span>" + step.time + "</span>";
    list.appendChild(li);
  });
}

/* =========================================================
   15. RESOLVE - calls backend PATCH endpoint
   ========================================================= */
document.getElementById("resolve-btn").addEventListener("click", async function () {
  var alert = getSelectedCase();
  if (!alert || alert.status === "Resolved" || alert.status === "Cancelled") return;

  var resolveBtn = document.getElementById("resolve-btn");
  resolveBtn.disabled = true;
  resolveBtn.textContent = "Resolving\u2026";

  try {
    var response = await fetch(
      CONFIG.API_BASE_URL + "/api/alerts/" + alert.id + "/resolve",
      { method: "PATCH" }
    );

    if (!response.ok) {
      var err = await response.json();
      console.error("[Dashboard] Resolve failed:", err.error ? err.error.message : response.status);
      resolveBtn.disabled = false;
      resolveBtn.textContent = "Resolve";
      return;
    }

    var data = await response.json();
    console.log("[Dashboard] Alert resolved via API:", data.alert.alert_id);

    var updated = backendToDashboard(data.alert);
    for (var i = 0; i < alerts.length; i++) {
      if (alerts[i].id === updated.id) {
        alerts[i] = updated;
        break;
      }
    }
    renderAll();
  } catch (err) {
    console.error("[Dashboard] Resolve error:", err.message);
    resolveBtn.disabled = false;
    resolveBtn.textContent = "Resolve";
  }
});

/* =========================================================
   16. ANALYTICS
   ========================================================= */
function renderAnalytics() {
  var active = alerts.filter(function (a) { return a.status === "Active"; }).length;
  var resolved = alerts.filter(function (a) { return a.status === "Resolved"; }).length;
  var escalated = alerts.filter(function (a) { return a.status === "Escalated"; }).length;

  document.getElementById("stat-active").textContent = active;
  document.getElementById("stat-resolved").textContent = resolved;
  document.getElementById("stat-escalated").textContent = escalated;

  var responseTimes = alerts
    .filter(function (a) { return a.acknowledgedAt && a.createdAt; })
    .map(function (a) {
      return (new Date(a.acknowledgedAt) - new Date(a.createdAt)) / 60000;
    });

  if (responseTimes.length > 0) {
    var avg = responseTimes.reduce(function (s, t) { return s + t; }, 0) / responseTimes.length;
    document.getElementById("stat-response").textContent = avg.toFixed(1) + "m";
  } else {
    document.getElementById("stat-response").textContent = "\u2014";
  }
}

/* =========================================================
   17. SIDEBAR NAVIGATION
   ========================================================= */
function switchView(viewName) {
  document.querySelectorAll(".view").forEach(function (view) {
    view.classList.remove("active");
  });
  document.querySelectorAll(".nav-item").forEach(function (item) {
    item.classList.remove("active");
  });

  var viewEl = document.getElementById("view-" + viewName);
  var navEl = document.querySelector('.nav-item[data-view="' + viewName + '"]');
  var viewTag = document.getElementById("view-tag");

  if (viewEl) viewEl.classList.add("active");
  if (navEl) navEl.classList.add("active");
  if (viewTag && navEl) viewTag.textContent = navEl.textContent.trim();

  if (viewName === "command-center") {
    setTimeout(function () {
      map.invalidateSize();
      centerMapOnSelectedCase();
    }, 0);
  }
}

document.querySelectorAll(".nav-item").forEach(function (item) {
  item.addEventListener("click", function () {
    switchView(item.getAttribute("data-view"));
  });
});

/* =========================================================
   18. RENDER ALL
   ========================================================= */
function renderAll() {
  renderMarkers();
  renderCaseList();
  renderSelectedCase();
  renderRecording();
  renderEvidence();
  renderHistory();
  renderAnalytics();
}

/* =========================================================
   19. INIT - load from API, connect Socket.IO
   ========================================================= */
loadAlertsFromAPI();
connectSocket();
