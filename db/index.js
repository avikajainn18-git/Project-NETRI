// =============================================
//  Project-NETRI — Database Layer
//  Uses better-sqlite3 (synchronous SQLite3)
// =============================================

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

// -------------------------------------------
//  Configuration
// -------------------------------------------

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'netri.db');

// Valid alert statuses — single source of truth
const ALERT_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  ESCALATED: 'ESCALATED',
  RESOLVED: 'RESOLVED',
  CANCELLED: 'CANCELLED',
});

const VALID_STATUSES = Object.values(ALERT_STATUSES);

// -------------------------------------------
//  Database Initialization
// -------------------------------------------

let db = null;

/**
 * Initialize the SQLite database.
 * - Opens (or creates) the database file at DB_PATH.
 * - Creates the alerts table if it does not exist.
 * - Returns the database instance.
 */
function initializeDatabase() {
  if (db) return db;

  db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');

  // Create the alerts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      alert_id      TEXT PRIMARY KEY,
      device_id     TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      triggered_at  TEXT,
      latitude      REAL,
      longitude     REAL,
      battery_level INTEGER,
      signal_status TEXT,
      status        TEXT NOT NULL DEFAULT 'ACTIVE'
                    CHECK(status IN ('ACTIVE', 'ACKNOWLEDGED', 'ESCALATED', 'RESOLVED', 'CANCELLED')),
      acknowledged_at TEXT,
      resolved_at   TEXT
    );
  `);

  // Index on status for fast filtering of active alerts
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
  `);

  // Index on device_id for fast lookups per device
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_alerts_device ON alerts(device_id);
  `);

  console.log(`[Database] Initialized at ${DB_PATH}`);
  return db;
}

/**
 * Get the database instance.
 * Throws if initializeDatabase() has not been called yet.
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

// -------------------------------------------
//  Alert CRUD Operations
// -------------------------------------------

/**
 * Insert a new alert.
 * @param {Object} data - Alert data
 * @param {string} data.deviceId - Required. Device identifier.
 * @param {string} [data.triggeredAt] - When the emergency was triggered.
 * @param {number} [data.latitude] - GPS latitude.
 * @param {number} [data.longitude] - GPS longitude.
 * @param {number} [data.batteryLevel] - Battery level (0-100).
 * @param {string} [data.signalStatus] - Signal quality string.
 * @returns {Object} The created alert record.
 */
function insertAlert(data) {
  const alertId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const stmt = getDb().prepare(`
    INSERT INTO alerts (
      alert_id, device_id, created_at, triggered_at,
      latitude, longitude, battery_level, signal_status, status
    ) VALUES (
      @alertId, @deviceId, @createdAt, @triggeredAt,
      @latitude, @longitude, @batteryLevel, @signalStatus, @status
    )
  `);

  stmt.run({
    alertId,
    deviceId: data.deviceId,
    createdAt,
    triggeredAt: data.triggeredAt || null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    batteryLevel: data.batteryLevel ?? null,
    signalStatus: data.signalStatus || null,
    status: ALERT_STATUSES.ACTIVE,
  });

  return getAlertById(alertId);
}

/**
 * Get a single alert by its ID.
 * @param {string} alertId
 * @returns {Object|null} The alert record, or null if not found.
 */
function getAlertById(alertId) {
  return getDb()
    .prepare('SELECT * FROM alerts WHERE alert_id = ?')
    .get(alertId) || null;
}

/**
 * Get alerts with optional filters.
 * @param {Object} [filters]
 * @param {string} [filters.status] - Filter by status.
 * @param {string} [filters.deviceId] - Filter by device ID.
 * @param {number} [filters.limit] - Max results (default 50).
 * @param {number} [filters.offset] - Pagination offset.
 * @returns {Object[]} Array of alert records.
 */
function getAlerts(filters = {}) {
  const conditions = [];
  const params = {};

  if (filters.status) {
    conditions.push('status = @status');
    params.status = filters.status;
  }

  if (filters.deviceId) {
    conditions.push('device_id = @deviceId');
    params.deviceId = filters.deviceId;
  }

  const where = conditions.length > 0
    ? 'WHERE ' + conditions.join(' AND ')
    : '';

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  return getDb()
    .prepare(`SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset });
}

/**
 * Update specific fields on an alert.
 * @param {string} alertId
 * @param {Object} updates - Fields to update (only provided fields are set).
 * @returns {Object|null} The updated alert, or null if not found.
 */
function updateAlert(alertId, updates) {
  const allowedFields = [
    'status', 'triggered_at', 'latitude', 'longitude',
    'battery_level', 'signal_status', 'acknowledged_at', 'resolved_at',
  ];

  const setClauses = [];
  const params = { alertId };

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      setClauses.push(`${key} = @${key}`);
      params[key] = value;
    }
  }

  if (setClauses.length === 0) return getAlertById(alertId);

  getDb()
    .prepare(`UPDATE alerts SET ${setClauses.join(', ')} WHERE alert_id = @alertId`)
    .run(params);

  return getAlertById(alertId);
}

/**
 * Convenience: transition an alert to a new status with the
 * appropriate timestamp set automatically.
 *
 * Status transitions:
 *   ACTIVE → ACKNOWLEDGED  (sets acknowledged_at)
 *   ACTIVE → CANCELLED     (sets resolved_at)
 *   ACTIVE → ESCALATED     (no extra timestamp)
 *   ACKNOWLEDGED → ESCALATED
 *   ACKNOWLEDGED → RESOLVED (sets resolved_at)
 *   ESCALATED → RESOLVED   (sets resolved_at)
 *
 * @param {string} alertId
 * @param {string} newStatus - One of the ALERT_STATUSES values.
 * @returns {Object|null} The updated alert, or null if not found.
 */
function transitionAlertStatus(alertId, newStatus) {
  if (!VALID_STATUSES.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const alert = getAlertById(alertId);
  if (!alert) return null;

  const now = new Date().toISOString();
  const updates = { status: newStatus };

  // Auto-set timestamp fields based on transition
  if (newStatus === ALERT_STATUSES.ACKNOWLEDGED && !alert.acknowledged_at) {
    updates.acknowledged_at = now;
  }

  if (newStatus === ALERT_STATUSES.RESOLVED && !alert.resolved_at) {
    updates.resolved_at = now;
  }

  if (newStatus === ALERT_STATUSES.CANCELLED && !alert.resolved_at) {
    updates.resolved_at = now;
  }

  return updateAlert(alertId, updates);
}

// -------------------------------------------
//  Exports
// -------------------------------------------

module.exports = {
  // Initialization
  initializeDatabase,
  getDb,

  // Constants
  ALERT_STATUSES,
  VALID_STATUSES,

  // Alert operations
  insertAlert,
  getAlertById,
  getAlerts,
  updateAlert,
  transitionAlertStatus,
};
