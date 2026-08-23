// =============================================
//  Project-NETRI — Socket.IO Service
//  Singleton module that holds the Socket.IO
//  instance and provides emit helpers for
//  real-time alert lifecycle events.
// =============================================

let io = null;

/**
 * Initialize the Socket.IO reference.
 * Must be called once from server.js after the
 * Socket.IO server is created.
 *
 * @param {import('socket.io').Server} socketIo
 */
function initSocket(socketIo) {
  io = socketIo;
  console.log('[Socket.IO] Service initialized');
}

/**
 * Emit an event to all connected clients.
 * Safe to call even if io is not initialized
 * (logs a warning instead of crashing).
 *
 * @param {string} event - Event name
 * @param {Object} data  - Payload
 */
function emit(event, data) {
  if (!io) {
    console.warn(`[Socket.IO] Cannot emit '${event}' — service not initialized`);
    return;
  }
  io.emit(event, data);
}

// -------------------------------------------
//  Alert Event Emitters
//
//  Event names use the pattern:
//    alert:<action>
//
//  All payloads include the full alert record
//  so the frontend can render immediately
//  without an extra API call.
// -------------------------------------------

/**
 * Emit when a new alert is created.
 * Event:   "alert:created"
 * Payload: { alert: { ...full alert record } }
 */
function emitAlertCreated(alert) {
  emit('alert:created', { alert });
  console.log(`[Socket.IO] Emitted alert:created — ${alert.alert_id}`);
}

/**
 * Emit when an alert is acknowledged.
 * Event:   "alert:acknowledged"
 * Payload: { alert: { ...full updated alert record } }
 */
function emitAlertAcknowledged(alert) {
  emit('alert:acknowledged', { alert });
  console.log(`[Socket.IO] Emitted alert:acknowledged — ${alert.alert_id}`);
}

/**
 * Emit when an alert is resolved.
 * Event:   "alert:resolved"
 * Payload: { alert: { ...full updated alert record } }
 */
function emitAlertResolved(alert) {
  emit('alert:resolved', { alert });
  console.log(`[Socket.IO] Emitted alert:resolved — ${alert.alert_id}`);
}

/**
 * Emit when an alert is cancelled.
 * Event:   "alert:cancelled"
 * Payload: { alert: { ...full updated alert record } }
 */
function emitAlertCancelled(alert) {
  emit('alert:cancelled', { alert });
  console.log(`[Socket.IO] Emitted alert:cancelled — ${alert.alert_id}`);
}

/**
 * Emit when an alert is escalated.
 * Event:   "alert:escalated"
 * Payload: { alert: { ...full updated alert record } }
 */
function emitAlertEscalated(alert) {
  emit('alert:escalated', { alert });
  console.log(`[Socket.IO] Emitted alert:escalated — ${alert.alert_id}`);
}

// -------------------------------------------
//  Exports
// -------------------------------------------

module.exports = {
  initSocket,
  emit,
  emitAlertCreated,
  emitAlertAcknowledged,
  emitAlertResolved,
  emitAlertCancelled,
  emitAlertEscalated,
};
