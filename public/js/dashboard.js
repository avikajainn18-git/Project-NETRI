/* =========================================================
   1. DUMMY ALERT DATA (replace with backend data later)
   ========================================================= */
let alerts = [
  {
    id: "SIH-1042",
    status: "Active",
    location: "Sector 21, Rohini",
    lat: 28.7182,
    lng: 77.1214,
    time: "14:32",
    deviceId: "NETRI-01",
    triggerMethod: "3-Tap",
    channel: "GSM",
    recording: {
      available: true,
      toneHz: 440
    },
    evidence: [
      { label: "Location Captured", done: true },
      { label: "Voice Recording Available", done: true },
      { label: "Timestamp Recorded", done: true }
    ],
    history: [
      { status: "SOS Triggered", time: "14:32" },
      { status: "Alert Received", time: "14:32" },
      { status: "Location Captured", time: "14:32" },
      { status: "Recording Received", time: "14:32" },
      { status: "Acknowledged", time: "14:33" }
    ]
  },
  {
    id: "SIH-1041",
    status: "Escalated",
    location: "Connaught Place",
    lat: 28.6315,
    lng: 77.2167,
    time: "14:20",
    deviceId: "NETRI-07",
    triggerMethod: "Voice Trigger",
    channel: "GSM",
    recording: {
      available: true,
      toneHz: 660
    },
    evidence: [
      { label: "Location Captured", done: true },
      { label: "Voice Recording Available", done: true },
      { label: "Timestamp Recorded", done: false }
    ],
    history: [
      { status: "SOS Triggered", time: "14:20" },
      { status: "Alert Received", time: "14:20" },
      { status: "Location Captured", time: "14:20" },
      { status: "Acknowledged", time: "14:21" },
      { status: "Escalated", time: "14:25" }
    ]
  }
];

let selectedCaseId = alerts[0].id;
let markers = {};

/* =========================================================
   2. MAP INITIALIZATION
   ========================================================= */
const map = L.map("map").setView([28.68, 77.17], 11);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "OpenStreetMap contributors"
}).addTo(map);

/* =========================================================
   3. MARKERS
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

    var isSelected = alert.id === selectedCaseId;

    var marker = L.circleMarker([alert.lat, alert.lng], {
      radius: isSelected ? 14 : 10,
      color: color,
      fillColor: color,
      fillOpacity: 0.85,
      weight: isSelected ? 4 : 2
    }).addTo(map);

    marker.bindTooltip(alert.id);
    marker.on("click", function () {
      selectCase(alert.id);
    });

    markers[alert.id] = marker;
  });
}

/* =========================================================
   4. CASE LIST
   ========================================================= */
function renderCaseList() {
  var tbody = document.getElementById("case-list-body");
  tbody.innerHTML = "";

  alerts.forEach(function (alert) {
    var row = document.createElement("tr");
    row.className = alert.id === selectedCaseId ? "selected-row" : "";
    row.innerHTML =
      "<td>" + alert.id + "</td>" +
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
   5. CASE SELECTION
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
   6. MAP CENTERING ON SELECTED CASE
   ========================================================= */
function centerMapOnSelectedCase() {
  var alert = getSelectedCase();
  if (!alert) return;
  map.setView([alert.lat, alert.lng], 15);
}

/* =========================================================
   7. SELECTED CASE (full incident details)
   ========================================================= */
function renderSelectedCase() {
  var alert = getSelectedCase();
  var title = document.getElementById("selected-case-title");
  var body = document.getElementById("selected-case-body");
  var resolveBtn = document.getElementById("resolve-btn");

  if (!alert) {
    title.textContent = "Selected Case";
    body.innerHTML = "<p>No case selected.</p>";
    return;
  }

  title.textContent = "Case " + alert.id;

  body.innerHTML =
    "<div class='incident-grid'>" +
      field("Status", "<span class='status-chip status-" + alert.status + "'>" + alert.status + "</span>") +
      field("Device", alert.deviceId) +
      field("Trigger", alert.triggerMethod) +
      field("Channel", alert.channel) +
      field("Location", alert.location) +
      field("Time", alert.time) +
      field("Coordinates", alert.lat + ", " + alert.lng) +
    "</div>";

  function field(label, value) {
    return "<div class='incident-field'><span class='field-label'>" + label + "</span>" + value + "</div>";
  }

  resolveBtn.disabled = alert.status === "Resolved";
  resolveBtn.textContent = alert.status === "Resolved" ? "Resolved" : "Resolve";
}

/* =========================================================
   8. RECORDING (frontend demo only — synthesized tone)
   ========================================================= */
let demoAudioCtx = null;

function renderRecording() {
  var alert = getSelectedCase();
  var statusEl = document.getElementById("recording-status");
  var playBtn = document.getElementById("play-recording-btn");

  if (!alert || !alert.recording || !alert.recording.available) {
    statusEl.textContent = "No recording available";
    playBtn.disabled = true;
    return;
  }

  statusEl.textContent = "Recording Available (" + alert.id + ")";
  playBtn.disabled = false;
}

function playSelectedRecording() {
  var alert = getSelectedCase();
  if (!alert || !alert.recording || !alert.recording.available) return;

  if (!demoAudioCtx) {
    demoAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  var oscillator = demoAudioCtx.createOscillator();
  var gain = demoAudioCtx.createGain();

  oscillator.frequency.value = alert.recording.toneHz || 440;
  gain.gain.value = 0.15;

  oscillator.connect(gain);
  gain.connect(demoAudioCtx.destination);

  oscillator.start();
  oscillator.stop(demoAudioCtx.currentTime + 0.6);

  var statusEl = document.getElementById("recording-status");
  var originalText = statusEl.textContent;
  statusEl.textContent = "Playing demo recording for " + alert.id + "...";

  setTimeout(function () {
    statusEl.textContent = originalText;
  }, 700);
}

document.getElementById("play-recording-btn").addEventListener("click", playSelectedRecording);

/* =========================================================
   9. EVIDENCE (frontend demo only)
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
   10. INCIDENT HISTORY
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
   11. RESOLVE
   ========================================================= */
document.getElementById("resolve-btn").addEventListener("click", function () {
  var alert = getSelectedCase();
  if (!alert || alert.status === "Resolved") return;

  alert.status = "Resolved";
  alert.history.push({
    status: "Resolved",
    time: new Date().toTimeString().slice(0, 5)
  });

  renderMarkers();
  renderCaseList();
  renderSelectedCase();
  renderRecording();
  renderEvidence();
  renderHistory();
  renderAnalytics();
});

/* =========================================================
   12. ANALYTICS
   ========================================================= */
function renderAnalytics() {
  var active = alerts.filter(function (a) { return a.status === "Active"; }).length;
  var resolved = alerts.filter(function (a) { return a.status === "Resolved"; }).length;
  var escalated = alerts.filter(function (a) { return a.status === "Escalated"; }).length;

  document.getElementById("stat-active").textContent = active;
  document.getElementById("stat-resolved").textContent = resolved;
  document.getElementById("stat-escalated").textContent = escalated;
  document.getElementById("stat-response").textContent = "4m";
}

/* =========================================================
   13. SIDEBAR NAVIGATION (view switching only, no backend)
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
   INIT
   ========================================================= */
renderMarkers();
renderCaseList();
renderSelectedCase();
renderRecording();
renderEvidence();
renderHistory();
renderAnalytics();
centerMapOnSelectedCase();