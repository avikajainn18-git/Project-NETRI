// =============================================
//  Project-NETRI — Alert REST API
//  Mounted at /api/alerts
// =============================================

const { Router } = require('express');
const {
  insertAlert,
  getAlertById,
  getAlerts,
  transitionAlertStatus,
  insertIncidentEvent,
  getIncidentEvents,
  ALERT_STATUSES,
  EVENT_TYPES,
} = require('../db');
const {
  emitAlertCreated,
  emitAlertAcknowledged,
  emitAlertResolved,
  emitAlertCancelled,
} = require('../services/socket');
const { startEscalation, cancelEscalation } = require('../services/escalation');

const router = Router();

// -------------------------------------------
//  Validation Helpers
// -------------------------------------------

/**
 * Validate the alert creation payload.
 * Returns an array of error strings (empty = valid).
 */
function validateAlertPayload(body) {
  const errors = [];

  // deviceId — required
  if (!body.deviceId || typeof body.deviceId !== 'string' || body.deviceId.trim() === '') {
    errors.push('deviceId is required and must be a non-empty string');
  }

  // latitude — optional, but must be -90..90 if provided
  if (body.latitude !== undefined && body.latitude !== null) {
    const lat = Number(body.latitude);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      errors.push('latitude must be a number between -90 and 90');
    }
  }

  // longitude — optional, but must be -180..180 if provided
  if (body.longitude !== undefined && body.longitude !== null) {
    const lng = Number(body.longitude);
    if (Number.isNaN(lng) || lng < -180 || lng > 180) {
      errors.push('longitude must be a number between -180 and 180');
    }
  }

  // batteryLevel — optional, but must be 0..100 if provided
  if (body.batteryLevel !== undefined && body.batteryLevel !== null) {
    const bat = Number(body.batteryLevel);
    if (Number.isNaN(bat) || bat < 0 || bat > 100 || !Number.isInteger(bat)) {
      errors.push('batteryLevel must be an integer between 0 and 100');
    }
  }

  return errors;
}

/**
 * Validate that an alertId looks like a UUID.
 * Returns true if valid, false otherwise.
 */
function isValidAlertId(id) {
  return typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// -------------------------------------------
//  Valid status transitions (source of truth)
// -------------------------------------------

const VALID_TRANSITIONS = {
  [ALERT_STATUSES.ACTIVE]: [
    ALERT_STATUSES.ACKNOWLEDGED,
    ALERT_STATUSES.ESCALATED,
    ALERT_STATUSES.RESOLVED,
    ALERT_STATUSES.CANCELLED,
  ],
  [ALERT_STATUSES.ACKNOWLEDGED]: [
    ALERT_STATUSES.ESCALATED,
    ALERT_STATUSES.RESOLVED,
  ],
  [ALERT_STATUSES.ESCALATED]: [
    ALERT_STATUSES.RESOLVED,
  ],
  // RESOLVED and CANCELLED are terminal — no transitions out
};

/**
 * Check if a status transition is allowed.
 * Returns null if valid, or an error message string if not.
 */
function validateTransition(currentStatus, targetStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed) {
    return `Alert is in terminal status '${currentStatus}' — no further transitions allowed`;
  }
  if (!allowed.includes(targetStatus)) {
    return `Cannot transition from '${currentStatus}' to '${targetStatus}'`;
  }
  return null; // valid
}

// ===========================================
//  1. CREATE ALERT
//  POST /api/alerts
// ===========================================

router.post('/', (req, res) => {
  const errors = validateAlertPayload(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: { message: 'Validation failed', details: errors } });
  }

  try {
    const alert = insertAlert({
      deviceId: req.body.deviceId.trim(),
      triggeredAt: req.body.triggeredAt || null,
      latitude: req.body.latitude ?? null,
      longitude: req.body.longitude ?? null,
      batteryLevel: req.body.batteryLevel ?? null,
      signalStatus: req.body.signalStatus || null,
    });

    // Log timeline event
    insertIncidentEvent(
      alert.alert_id,
      EVENT_TYPES.ALERT_CREATED,
      'SOS alert created',
      { deviceId: alert.device_id, latitude: alert.latitude, longitude: alert.longitude, batteryLevel: alert.battery_level, signalStatus: alert.signal_status }
    );

    // Broadcast to connected dashboard clients
    emitAlertCreated(alert);

    // Start automatic escalation timer
    startEscalation(alert.alert_id);

    return res.status(201).json({ alert });
  } catch (err) {
    console.error('[Alerts] Create error:', err.message);
    return res.status(500).json({ error: { message: 'Failed to create alert' } });
  }
});

// ===========================================
//  2. GET ALL ALERTS
//  GET /api/alerts?status=ACTIVE&deviceId=xxx
// ===========================================

router.get('/', (req, res) => {
  try {
    const filters = {};

    if (req.query.status) {
      const status = req.query.status.toUpperCase();
      if (!ALERT_STATUSES[status]) {
        return res.status(400).json({
          error: {
            message: `Invalid status filter: '${req.query.status}'`,
            validValues: Object.keys(ALERT_STATUSES),
          },
        });
      }
      filters.status = status;
    }

    if (req.query.deviceId) {
      filters.deviceId = req.query.deviceId;
    }

    if (req.query.limit) {
      filters.limit = parseInt(req.query.limit, 10);
    }

    if (req.query.offset) {
      filters.offset = parseInt(req.query.offset, 10);
    }

    const alerts = getAlerts(filters);
    return res.json({ alerts, count: alerts.length });
  } catch (err) {
    console.error('[Alerts] List error:', err.message);
    return res.status(500).json({ error: { message: 'Failed to retrieve alerts' } });
  }
});

// ===========================================
//  3. GET ACTIVE ALERTS
//  GET /api/alerts/active
//
//  IMPORTANT: This route MUST be defined BEFORE
//  /:alertId or Express will match "active" as
//  an alertId parameter.
// ===========================================

router.get('/active', (_req, res) => {
  try {
    const alerts = getAlerts({ status: ALERT_STATUSES.ACTIVE });
    return res.json({ alerts, count: alerts.length });
  } catch (err) {
    console.error('[Alerts] Active list error:', err.message);
    return res.status(500).json({ error: { message: 'Failed to retrieve active alerts' } });
  }
});

// ===========================================
//  4. GET ALERT TIMELINE
//  GET /api/alerts/:alertId/timeline
//
//  IMPORTANT: This route MUST be defined BEFORE
//  /:alertId or Express will match "timeline" as
//  an alertId parameter.
// ===========================================

router.get('/:alertId/timeline', (req, res) => {
  const { alertId } = req.params;

  if (!isValidAlertId(alertId)) {
    return res.status(400).json({ error: { message: 'Invalid alertId format — must be a valid UUID' } });
  }

  try {
    const alert = getAlertById(alertId);
    if (!alert) {
      return res.status(404).json({ error: { message: `Alert not found: ${alertId}` } });
    }

    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;

    const events = getIncidentEvents(alertId, { limit, offset });

    return res.json({
      alert_id: alertId,
      status: alert.status,
      events,
      count: events.length,
    });
  } catch (err) {
    console.error('[Alerts] Timeline error:', err.message);
    return res.status(500).json({ error: { message: 'Failed to retrieve timeline' } });
  }
});

// ===========================================
//  5. GET SINGLE ALERT
//  GET /api/alerts/:alertId
// ===========================================

router.get('/:alertId', (req, res) => {
  const { alertId } = req.params;

  if (!isValidAlertId(alertId)) {
    return res.status(400).json({ error: { message: 'Invalid alertId format — must be a valid UUID' } });
  }

  try {
    const alert = getAlertById(alertId);
    if (!alert) {
      return res.status(404).json({ error: { message: `Alert not found: ${alertId}` } });
    }
    return res.json({ alert });
  } catch (err) {
    console.error('[Alerts] Get error:', err.message);
    return res.status(500).json({ error: { message: 'Failed to retrieve alert' } });
  }
});

// ===========================================
//  5. ACKNOWLEDGE ALERT
//  PATCH /api/alerts/:alertId/acknowledge
// ===========================================

router.patch('/:alertId/acknowledge', (req, res) => {
  const { alertId } = req.params;

  if (!isValidAlertId(alertId)) {
    return res.status(400).json({ error: { message: 'Invalid alertId format — must be a valid UUID' } });
  }

  try {
    const alert = getAlertById(alertId);
    if (!alert) {
      return res.status(404).json({ error: { message: `Alert not found: ${alertId}` } });
    }

    const transitionError = validateTransition(alert.status, ALERT_STATUSES.ACKNOWLEDGED);
    if (transitionError) {
      return res.status(400).json({
        error: { message: transitionError, currentStatus: alert.status },
      });
    }

    const updated = transitionAlertStatus(alertId, ALERT_STATUSES.ACKNOWLEDGED);

    // Log timeline event
    insertIncidentEvent(
      alertId,
      EVENT_TYPES.STATUS_CHANGED,
      'Alert acknowledged',
      { from: alert.status, to: ALERT_STATUSES.ACKNOWLEDGED }
    );

    // Broadcast to connected dashboard clients
    emitAlertAcknowledged(updated);

    return res.json({ alert: updated });
  } catch (err) {
    console.error('[Alerts] Acknowledge error:', err.message);
    return res.status(500).json({ error: { message: 'Failed to acknowledge alert' } });
  }
});

// ===========================================
//  6. RESOLVE ALERT
//  PATCH /api/alerts/:alertId/resolve
// ===========================================

router.patch('/:alertId/resolve', (req, res) => {
  const { alertId } = req.params;

  if (!isValidAlertId(alertId)) {
    return res.status(400).json({ error: { message: 'Invalid alertId format — must be a valid UUID' } });
  }

  try {
    const alert = getAlertById(alertId);
    if (!alert) {
      return res.status(404).json({ error: { message: `Alert not found: ${alertId}` } });
    }

    const transitionError = validateTransition(alert.status, ALERT_STATUSES.RESOLVED);
    if (transitionError) {
      return res.status(400).json({
        error: { message: transitionError, currentStatus: alert.status },
      });
    }

    const updated = transitionAlertStatus(alertId, ALERT_STATUSES.RESOLVED);

    // Log timeline event
    insertIncidentEvent(
      alertId,
      EVENT_TYPES.STATUS_CHANGED,
      'Alert resolved',
      { from: alert.status, to: ALERT_STATUSES.RESOLVED }
    );

    // Broadcast to connected dashboard clients
    emitAlertResolved(updated);

    // Stop escalation for resolved incident
    cancelEscalation(alertId);

    return res.json({ alert: updated });
  } catch (err) {
    console.error('[Alerts] Resolve error:', err.message);
    return res.status(500).json({ error: { message: 'Failed to resolve alert' } });
  }
});

// ===========================================
//  7. CANCEL ALERT
//  PATCH /api/alerts/:alertId/cancel
// ===========================================

router.patch('/:alertId/cancel', (req, res) => {
  const { alertId } = req.params;

  if (!isValidAlertId(alertId)) {
    return res.status(400).json({ error: { message: 'Invalid alertId format — must be a valid UUID' } });
  }

  try {
    const alert = getAlertById(alertId);
    if (!alert) {
      return res.status(404).json({ error: { message: `Alert not found: ${alertId}` } });
    }

    const transitionError = validateTransition(alert.status, ALERT_STATUSES.CANCELLED);
    if (transitionError) {
      return res.status(400).json({
        error: { message: transitionError, currentStatus: alert.status },
      });
    }

    const updated = transitionAlertStatus(alertId, ALERT_STATUSES.CANCELLED);

    // Log timeline event
    insertIncidentEvent(
      alertId,
      EVENT_TYPES.STATUS_CHANGED,
      'Alert cancelled',
      { from: alert.status, to: ALERT_STATUSES.CANCELLED }
    );

    // Broadcast to connected dashboard clients
    emitAlertCancelled(updated);

    // Stop escalation for cancelled incident
    cancelEscalation(alertId);

    return res.json({ alert: updated });
  } catch (err) {
    console.error('[Alerts] Cancel error:', err.message);
    return res.status(500).json({ error: { message: 'Failed to cancel alert' } });
  }
});

// -------------------------------------------
//  Export the router
// -------------------------------------------

module.exports = router;
