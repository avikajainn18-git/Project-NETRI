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
    history: [
      { status: "SOS Received", time: "14:32" },
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
    history: [
      { status: "SOS Received", time: "14:20" },
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
    var color = "#ffb300";
    if (alert.status === "Escalated") color = "#ff1744";
    if (alert.status === "Resolved") color = "#4caf50";

    var marker = L.circleMarker([alert.lat, alert.lng], {
      radius: 12,
      color: color,
      fillColor: color,
      fillOpacity: 0.8,
      weight: alert.id === selectedCaseId ? 4 : 2
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
  renderHistory();
  renderErss();
}

function getSelectedCase() {
  return alerts.find(function (a) {
    return a.id === selectedCaseId;
  });
}

/* =========================================================
   6. SELECTED CASE
   ========================================================= */
function renderSelectedCase() {
  var alert = getSelectedCase();
  var body = document.getElementById("selected-case-body");
  var resolveBtn = document.getElementById("resolve-btn");

  if (!alert) {
    body.innerHTML = "<p>No case selected.</p>";
    return;
  }

  body.innerHTML =
    "<p><strong>Case ID:</strong> " + alert.id + "</p>" +
    "<p><strong>Status:</strong> <span class='status-chip status-" + alert.status + "'>" + alert.status + "</span></p>" +
    "<p><strong>Location:</strong> " + alert.location + "</p>" +
    "<p><strong>Time:</strong> " + alert.time + "</p>";

  resolveBtn.disabled = alert.status === "Resolved";
  resolveBtn.textContent = alert.status === "Resolved" ? "Resolved" : "Resolve";
}

/* =========================================================
   7. CASE HISTORY
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
   8. RESOLVE
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
  renderHistory();
  renderAnalytics();
  renderErss();
});

/* =========================================================
   9. ANALYTICS
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
   10. ERSS
   ========================================================= */
function renderErss() {
  var alert = getSelectedCase();
  var panel = document.getElementById("erss-panel");
  var status = document.getElementById("erss-status");

  if (alert && alert.status === "Escalated") {
    panel.classList.add("active");
    status.textContent = "ACTIVE - CASE ESCALATED";
  } else {
    panel.classList.remove("active");
    status.textContent = "STANDBY";
  }
}

/* =========================================================
   INIT
   ========================================================= */
renderMarkers();
renderCaseList();
renderSelectedCase();
renderHistory();
renderAnalytics();
renderErss();