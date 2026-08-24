// =============================================
//  Project-NETRI — Escalation Service
//  Automatic severity escalation based on
//  elapsed time since SOS when no user response
//  is received.
//
//  Severity progression:
//    MEDIUM → HIGH (after 30s without response)
//    HIGH → CRITICAL + ESCALATED (after 60s)
//
//  When user responds: escalation is cancelled.
//  Terminal alerts (RESOLVED/CANCELLED) are never escalated.
// =============================================

const {
  getAlertById,
  getActiveAlerts,
  updateAlertSeverity,
  transitionAlertStatus,
  insertIncidentEvent,
  EVENT_TYPES,
  ALERT_STATUSES,
} = require('../db');
const {
  emitAlertSeverityChanged,
  emitAlertEscalated,
} = require('./socket');

// -------------------------------------------
//  Configurable Thresholds
// -------------------------------------------

const DEFAULT_THRESHOLDS = Object.freeze({
  MEDIUM_TO_HIGH_MS: 30 * 1000,      // 30 seconds
  HIGH_TO_CRITICAL_MS: 60 * 1000,    // 60 seconds (30s after HIGH)
});

// Allow env-var overrides for testing
let thresholds = {
  MEDIUM_TO_HIGH_MS: parseInt(process.env.ESCALATION_MEDIUM_TO_HIGH_MS, 10) || DEFAULT_THRESHOLDS.MEDIUM_TO_HIGH_MS,
  HIGH_TO_CRITICAL_MS: parseInt(process.env.ESCALATION_HIGH_TO_CRITICAL_MS, 10) || DEFAULT_THRESHOLDS.HIGH_TO_CRITICAL_MS,
};

// -------------------------------------------
//  In-Memory Timer Registry
// -------------------------------------------

// Map<alertId, timeoutId>
const activeTimers = new Map();

// -------------------------------------------
//  Configuration
// -------------------------------------------

/**
 * Override escalation thresholds (useful for testing).
 * @param {Object} overrides - { MEDIUM_TO_HIGH_MS, HIGH_TO_CRITICAL_MS }
 */
function configure(overrides) {
  if (overrides.MEDIUM_TO_HIGH_MS !== undefined) {
    thresholds.MEDIUM_TO_HIGH_MS = overrides.MEDIUM_TO_HIGH_MS;
  }
  if (overrides.HIGH_TO_CRITICAL_MS !== undefined) {
    thresholds.HIGH_TO_CRITICAL_MS = overrides.HIGH_TO_CRITICAL_MS;
  }
}

/**
 * Reset thresholds to defaults.
 */
function resetConfig() {
  thresholds = { ...DEFAULT_THRESHOLDS };
}

/**
 * Get current thresholds (for testing).
 */
function getThresholds() {
  return { ...thresholds };
}

// -------------------------------------------
//  Core Escalation Logic
// -------------------------------------------

const SEVERITY_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function severityIndex(s) {
  return SEVERITY_ORDER.indexOf(s);
}

/**
 * Evaluate whether an alert should be escalated based on current time.
 * This is the pure, testable core — no side effects from timers.
 *
 * @param {Object} alert - Alert record from database
 * @param {Date} [now] - Current time (for testing; defaults to new Date())
 * @returns {Object|null} Escalation result or null if no action needed
 */
function evaluateEscalation(alert, now = new Date()) {
  // Never escalate terminal incidents
  if (!alert || [ALERT_STATUSES.RESOLVED, ALERT_STATUSES.CANCELLED].includes(alert.status)) {
    return null;
  }

  // Never escalate if already at max severity
  if (alert.severity === 'CRITICAL') {
    return null;
  }

  // Check if user has responded — if so, no escalation
  const { hasUserResponded, getIncidentEvents } = require('../db');
  if (hasUserResponded(alert.alert_id)) {
    return null;
  }

  // Deduplication: check if this exact severity level was already escalated
  // This prevents duplicate events when timers fire after server restart
  const existingEvents = getIncidentEvents(alert.alert_id);
  const existingSeverities = new Set(
    existingEvents
      .filter(e => e.event_type === 'SEVERITY_CHANGED')
      .map(e => {
        const meta = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata;
        return meta?.severity;
      })
  );

  const createdAt = new Date(alert.created_at).getTime();
  const elapsed = now.getTime() - createdAt;

  const currentSeverity = alert.severity || 'MEDIUM';
  const currentIdx = severityIndex(currentSeverity);

  // Determine target severity based on elapsed time
  let targetSeverity = null;

  if (currentIdx < severityIndex('HIGH') && elapsed >= thresholds.MEDIUM_TO_HIGH_MS) {
    targetSeverity = 'HIGH';
  }

  if (currentIdx < severityIndex('CRITICAL') && elapsed >= thresholds.HIGH_TO_CRITICAL_MS) {
    targetSeverity = 'CRITICAL';
  }

  if (!targetSeverity || targetSeverity === currentSeverity) {
    return null;
  }

  // If this severity level was already escalated, skip
  if (existingSeverities.has(targetSeverity)) {
    return null;
  }

  // Determine if this escalation should also change status
  const newStatus = (targetSeverity === 'CRITICAL' && alert.status !== ALERT_STATUSES.ESCALATED)
    ? ALERT_STATUSES.ESCALATED
    : null;

  return {
    alertId: alert.alert_id,
    previousSeverity: currentSeverity,
    severity: targetSeverity,
    previousStatus: alert.status,
    newStatus,
    reason: newStatus === ALERT_STATUSES.ESCALATED
      ? `No user response after ${Math.round(elapsed / 1000)}s — incident escalated`
      : `No user response after ${Math.round(elapsed / 1000)}s — severity increased`,
    elapsed,
    userResponded: false,
  };
}

/**
 * Apply an escalation result: update DB, create timeline events, emit Socket.IO.
 * @param {Object} result - From evaluateEscalation()
 */
function applyEscalation(result) {
  if (!result) return;

  const { alertId, previousSeverity, severity, previousStatus, newStatus, reason, elapsed } = result;
  const changedAt = new Date().toISOString();

  // 1. Update severity in DB
  updateAlertSeverity(alertId, severity);

  // 2. Create SEVERITY_CHANGED timeline event
  insertIncidentEvent(
    alertId,
    EVENT_TYPES.SEVERITY_CHANGED,
    `Severity changed: ${previousSeverity} → ${severity}`,
    {
      previousSeverity,
      severity,
      reason,
      elapsedSeconds: Math.round(elapsed / 1000),
      userResponded: false,
    },
  );

  // 3. If status changes (HIGH→CRITICAL triggers ESCALATED)
  if (newStatus) {
    transitionAlertStatus(alertId, newStatus);

    insertIncidentEvent(
      alertId,
      EVENT_TYPES.STATUS_CHANGED,
      `Alert escalated to ${newStatus}`,
      { from: previousStatus, to: newStatus, reason },
    );

    // Emit existing escalation event
    const updatedAlert = getAlertById(alertId);
    if (updatedAlert) emitAlertEscalated(updatedAlert);
  }

  // 4. Emit severity-changed event
  emitAlertSeverityChanged({
    alert_id: alertId,
    previous_severity: previousSeverity,
    severity,
    reason,
    changed_at: changedAt,
  });

  console.log(`[Escalation] ${alertId}: ${previousSeverity} → ${severity}${newStatus ? ` (${newStatus})` : ''}`);
}

// -------------------------------------------
//  Timer Management
// -------------------------------------------

/**
 * Start escalation monitoring for an alert.
 * Sets a timer that fires when the next threshold is reached.
 *
 * @param {string} alertId
 * @param {Date} [createdAt] - When the alert was created (for timer calculation)
 */
function startEscalation(alertId, createdAt) {
  cancelEscalation(alertId);

  const alert = getAlertById(alertId);
  if (!alert || [ALERT_STATUSES.RESOLVED, ALERT_STATUSES.CANCELLED].includes(alert.status)) {
    return;
  }

  // Use severity_changed_at for timer calculation (relative to last severity change)
  // Fall back to created_at for alerts without severity_changed_at
  const referenceTime = alert.severity_changed_at
    ? new Date(alert.severity_changed_at).getTime()
    : (createdAt ? createdAt.getTime() : new Date(alert.created_at).getTime());
  const now = Date.now();
  const elapsed = now - referenceTime;

  // Calculate when the next threshold fires
  let nextThresholdMs = null;

  if (elapsed < thresholds.MEDIUM_TO_HIGH_MS) {
    nextThresholdMs = thresholds.MEDIUM_TO_HIGH_MS - elapsed;
  } else if (elapsed < thresholds.HIGH_TO_CRITICAL_MS) {
    nextThresholdMs = thresholds.HIGH_TO_CRITICAL_MS - elapsed;
  }
  // If already past all thresholds, evaluate on next tick (avoid synchronous recursion)
  else {
    nextThresholdMs = 0;
  }

  const timerId = setTimeout(() => {
    activeTimers.delete(alertId);
    evaluateAndApply(alertId);
  }, nextThresholdMs);

  activeTimers.set(alertId, timerId);
}

/**
 * Evaluate and apply escalation for an alert, then reschedule if needed.
 */
function evaluateAndApply(alertId) {
  const alert = getAlertById(alertId);
  if (!alert) return;

  const result = evaluateEscalation(alert);
  if (result) {
    applyEscalation(result);
  }

  // If still active and not at max severity, reschedule
  if (
    alert.status !== ALERT_STATUSES.RESOLVED &&
    alert.status !== ALERT_STATUSES.CANCELLED &&
    (result ? result.severity !== 'CRITICAL' : alert.severity !== 'CRITICAL')
  ) {
    startEscalation(alertId);
  }
}

/**
 * Cancel escalation monitoring for an alert.
 * Called when user responds or incident is resolved/cancelled.
 * @param {string} alertId
 */
function cancelEscalation(alertId) {
  const timerId = activeTimers.get(alertId);
  if (timerId !== undefined) {
    clearTimeout(timerId);
    activeTimers.delete(alertId);
  }
}

/**
 * Stop all escalation timers.
 * Used during server shutdown.
 */
function stopAll() {
  for (const [alertId, timerId] of activeTimers) {
    clearTimeout(timerId);
  }
  activeTimers.clear();
}

/**
 * Evaluate all active alerts for immediate escalation.
 * Called on server restart to catch alerts that exceeded
 * thresholds while the server was down.
 */
function recoverEscalations() {
  const activeAlerts = getActiveAlerts();
  let recovered = 0;

  for (const alert of activeAlerts) {
    const result = evaluateEscalation(alert);
    if (result) {
      applyEscalation(result);
      recovered++;
    }

    // Reschedule future escalation for alerts not yet at CRITICAL
    if (alert.severity !== 'CRITICAL' && alert.status !== ALERT_STATUSES.ESCALATED) {
      startEscalation(alert.alert_id);
    }
  }

  if (recovered > 0) {
    console.log(`[Escalation] Recovered ${recovered} escalated alert(s) on restart`);
  }

  return recovered;
}

/**
 * Get count of active escalation timers (for testing).
 */
function getActiveTimerCount() {
  return activeTimers.size;
}

// -------------------------------------------
//  Exports
// -------------------------------------------

module.exports = {
  configure,
  resetConfig,
  getThresholds,
  evaluateEscalation,
  applyEscalation,
  startEscalation,
  cancelEscalation,
  stopAll,
  recoverEscalations,
  getActiveTimerCount,
  SEVERITY_ORDER,
};
