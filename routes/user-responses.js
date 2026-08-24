// =============================================
//  Project-NETRI — User Response API
//  Tracks whether the Compact wearer responds
//  after an SOS event.
//
//  Mounted at /api/alerts (in server.js)
//  Endpoint: POST /api/alerts/:alertId/user-response
// =============================================

const { Router } = require('express');
const {
  getAlertById,
  insertIncidentEvent,
  hasUserResponded,
  ALERT_STATUSES,
  EVENT_TYPES,
} = require('../db');
const { emitAlertUserResponse } = require('../services/socket');
const { cancelEscalation } = require('../services/escalation');

const router = Router({ mergeParams: true });

// -------------------------------------------
//  Validation Helpers
// -------------------------------------------

const VALID_RESPONSE_TYPES = ['COMPACT_BUTTON', 'VOICE_CONFIRM', 'APP_ACKNOWLEDGE', 'OTHER'];

function isValidAlertId(id) {
  return typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// Terminal statuses where the incident is already closed
const TERMINAL_STATUSES = [ALERT_STATUSES.RESOLVED, ALERT_STATUSES.CANCELLED];

// ===========================================
//  RECORD USER RESPONSE
//  POST /api/alerts/:alertId/user-response
//
//  Request body:
//    { responseType: "COMPACT_BUTTON" }  (optional, defaults to COMPACT_BUTTON)
//
//  Response:
//    201 { response: { alert_id, event_id, response_type, responded_at } }
//    400 { error: { message, details? } }
//    404 { error: { message } }
//    409 { error: { message } }
// ===========================================

router.post('/:alertId/user-response', (req, res) => {
  const { alertId } = req.params;

  // 1. Validate alert ID format
  if (!isValidAlertId(alertId)) {
    return res.status(400).json({
      error: { message: 'Invalid alertId format — must be a valid UUID' },
    });
  }

  // 2. Validate optional responseType
  const responseType = (req.body?.responseType || 'COMPACT_BUTTON').toUpperCase();
  if (!VALID_RESPONSE_TYPES.includes(responseType)) {
    return res.status(400).json({
      error: {
        message: `Invalid responseType: '${responseType}'`,
        validValues: VALID_RESPONSE_TYPES,
      },
    });
  }

  try {
    // 3. Verify alert exists
    const alert = getAlertById(alertId);
    if (!alert) {
      return res.status(404).json({
        error: { message: `Alert not found: ${alertId}` },
      });
    }

    // 4. Reject if incident is already closed
    if (TERMINAL_STATUSES.includes(alert.status)) {
      return res.status(400).json({
        error: {
          message: `Cannot record response — alert is in terminal status '${alert.status}'`,
          currentStatus: alert.status,
        },
      });
    }

    // 5. Prevent duplicate responses
    const existingResponse = hasUserResponded(alertId);
    if (existingResponse) {
      return res.status(409).json({
        error: {
          message: 'User has already responded to this alert',
          existingEventId: existingResponse.event_id,
          respondedAt: existingResponse.created_at,
        },
      });
    }

    // 6. Record the response as a timeline event
    const respondedAt = new Date().toISOString();

    const event = insertIncidentEvent(
      alertId,
      EVENT_TYPES.USER_RESPONDED,
      `User responded via ${responseType}`,
      {
        responseType,
        respondedAt,
        source: 'compact',
      },
    );

    // 7. Cancel automatic escalation — user has responded
    cancelEscalation(alertId);

    // 8. Broadcast to connected clients
    emitAlertUserResponse({
      alert_id: alertId,
      event_id: event.event_id,
      response_type: responseType,
      responded_at: respondedAt,
    });

    console.log(`[UserResponse] ${responseType} — alert ${alertId} — escalation cancelled`);

    return res.status(201).json({
      response: {
        alert_id: alertId,
        event_id: event.event_id,
        response_type: responseType,
        responded_at: respondedAt,
      },
    });
  } catch (err) {
    console.error('[UserResponse] Error:', err.message);
    return res.status(500).json({
      error: { message: 'Failed to record user response' },
    });
  }
});

// -------------------------------------------
//  Export the router
// -------------------------------------------

module.exports = router;
