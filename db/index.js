// =============================================
//  Project-NETRI — Database Layer
//  Uses better-sqlite3 (synchronous SQLite3)
// =============================================

const Database = require('better-sqlite3');
const { randomUUID } = require('crypto');
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
      trusted_contacts TEXT,
      status        TEXT NOT NULL DEFAULT 'ACTIVE'
                    CHECK(status IN ('ACTIVE', 'ACKNOWLEDGED', 'ESCALATED', 'RESOLVED', 'CANCELLED')),
      acknowledged_at TEXT,
      resolved_at   TEXT
    );
  `);

  const alertColumns = db.prepare('PRAGMA table_info(alerts)').all().map((column) => column.name);
  if (!alertColumns.includes('trusted_contacts')) {
    db.exec('ALTER TABLE alerts ADD COLUMN trusted_contacts TEXT');
  }

  // Index on status for fast filtering of active alerts
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
  `);

  // Index on device_id for fast lookups per device
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_alerts_device ON alerts(device_id);
  `);

  // Create the devices table (latest state per device)
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      device_id     TEXT PRIMARY KEY,
      battery_level INTEGER,
      network_status TEXT,
      device_state  TEXT DEFAULT 'IDLE',
      latitude      REAL,
      longitude     REAL,
      last_heartbeat TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Create the incident_events table (chronological timeline per alert)
  db.exec(`
    CREATE TABLE IF NOT EXISTS incident_events (
      event_id      TEXT PRIMARY KEY,
      alert_id      TEXT NOT NULL,
      event_type    TEXT NOT NULL,
      description   TEXT NOT NULL,
      metadata      TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (alert_id) REFERENCES alerts(alert_id)
    );
  `);

  // Index on alert_id for fast timeline lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_events_alert ON incident_events(alert_id);
  `);

  // Index on created_at for chronological ordering
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_events_time ON incident_events(alert_id, created_at);
  `);

  // Create the evidence table (audio/video/hash records tied to alerts)
  db.exec(`
    CREATE TABLE IF NOT EXISTS evidence (
      evidence_id   TEXT PRIMARY KEY,
      alert_id      TEXT NOT NULL,
      evidence_type TEXT NOT NULL
                    CHECK(evidence_type IN ('AUDIO', 'VIDEO', 'HASH', 'DOCUMENT', 'OTHER')),
      file_path     TEXT NOT NULL,
      sha256_hash   TEXT,
      file_size     INTEGER,
      mime_type     TEXT,
      description   TEXT,
      uploaded_at   TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (alert_id) REFERENCES alerts(alert_id)
    );
  `);

  // Index on alert_id for fast evidence lookups per alert
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_evidence_alert ON evidence(alert_id);
  `);

  // Composite index on (alert_id, evidence_type) for typed queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_evidence_type ON evidence(alert_id, evidence_type);
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
  const alertId = randomUUID();
  const createdAt = new Date().toISOString();

  const stmt = getDb().prepare(`
    INSERT INTO alerts (
      alert_id, device_id, created_at, triggered_at,
      latitude, longitude, battery_level, signal_status, trusted_contacts, status
    ) VALUES (
      @alertId, @deviceId, @createdAt, @triggeredAt,
      @latitude, @longitude, @batteryLevel, @signalStatus, @trustedContacts, @status
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
    trustedContacts: data.trustedContacts ? JSON.stringify(data.trustedContacts) : null,
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
//  Incident Event (Timeline) Operations
// -------------------------------------------

/**
 * Valid event types for the incident timeline.
 */
const EVENT_TYPES = Object.freeze({
  ALERT_CREATED: 'ALERT_CREATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  LOCATION_UPDATED: 'LOCATION_UPDATED',
  DEVICE_HEARTBEAT: 'DEVICE_HEARTBEAT',
  NOTE_ADDED: 'NOTE_ADDED',
  EVIDENCE_UPLOADED: 'EVIDENCE_UPLOADED',
});

// Valid evidence types
const EVIDENCE_TYPES = Object.freeze({
  AUDIO: 'AUDIO',
  VIDEO: 'VIDEO',
  HASH: 'HASH',
  DOCUMENT: 'DOCUMENT',
  OTHER: 'OTHER',
});

/**
 * Insert a timeline event for an alert.
 * @param {string} alertId - The alert this event belongs to.
 * @param {string} eventType - One of EVENT_TYPES values.
 * @param {string} description - Human-readable description.
 * @param {Object} [metadata] - Optional JSON-serializable extra data.
 * @returns {Object} The created event record.
 */
function insertIncidentEvent(alertId, eventType, description, metadata = null) {
  const eventId = randomUUID();
  const createdAt = new Date().toISOString();

  getDb().prepare(`
    INSERT INTO incident_events (event_id, alert_id, event_type, description, metadata, created_at)
    VALUES (@eventId, @alertId, @eventType, @description, @metadata, @createdAt)
  `).run({
    eventId,
    alertId,
    eventType,
    description,
    metadata: metadata ? JSON.stringify(metadata) : null,
    createdAt,
  });

  return getDb()
    .prepare('SELECT * FROM incident_events WHERE event_id = ?')
    .get(eventId);
}

/**
 * Get all timeline events for an alert, ordered chronologically.
 * @param {string} alertId
 * @param {Object} [options]
 * @param {number} [options.limit] - Max results (default 100).
 * @param {number} [options.offset] - Pagination offset.
 * @returns {Object[]} Array of event records.
 */
function getIncidentEvents(alertId, options = {}) {
  const limit = options.limit || 100;
  const offset = options.offset || 0;

  return getDb()
    .prepare('SELECT * FROM incident_events WHERE alert_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?')
    .all(alertId, limit, offset);
}

// -------------------------------------------
//  Device CRUD Operations
// -------------------------------------------

/**
 * Get a single device by ID.
 * @param {string} deviceId
 * @returns {Object|null} The device record, or null if not found.
 */
function getDeviceById(deviceId) {
  return getDb()
    .prepare('SELECT * FROM devices WHERE device_id = ?')
    .get(deviceId) || null;
}

/**
 * Upsert a device's state from a heartbeat payload.
 * Creates the device row if it does not exist.
 *
 * @param {string} deviceId
 * @param {Object} data - Heartbeat data
 * @param {number} [data.battery]
 * @param {string} [data.network]
 * @param {string} [data.state]
 * @param {number} [data.latitude]
 * @param {number} [data.longitude]
 * @param {string} [data.timestamp]
 * @returns {Object} The device record.
 */
function upsertDeviceFromHeartbeat(deviceId, data) {
  const now = new Date().toISOString();
  const existing = getDeviceById(deviceId);

  if (existing) {
    getDb().prepare(`
      UPDATE devices SET
        battery_level = @batteryLevel,
        network_status = @networkStatus,
        device_state = @deviceState,
        latitude = @latitude,
        longitude = @longitude,
        last_heartbeat = @lastHeartbeat,
        updated_at = @updatedAt
      WHERE device_id = @deviceId
    `).run({
      deviceId,
      batteryLevel: data.battery ?? existing.battery_level,
      networkStatus: data.network ?? existing.network_status,
      deviceState: data.state ?? existing.device_state,
      latitude: data.latitude ?? existing.latitude,
      longitude: data.longitude ?? existing.longitude,
      lastHeartbeat: data.timestamp || now,
      updatedAt: now,
    });
  } else {
    getDb().prepare(`
      INSERT INTO devices (
        device_id, battery_level, network_status, device_state,
        latitude, longitude, last_heartbeat, created_at, updated_at
      ) VALUES (
        @deviceId, @batteryLevel, @networkStatus, @deviceState,
        @latitude, @longitude, @lastHeartbeat, @createdAt, @updatedAt
      )
    `).run({
      deviceId,
      batteryLevel: data.battery ?? null,
      networkStatus: data.network ?? 'UNKNOWN',
      deviceState: data.state ?? 'IDLE',
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      lastHeartbeat: data.timestamp || now,
      createdAt: now,
      updatedAt: now,
    });
  }

  return getDeviceById(deviceId);
}

/**
 * Update a device's location.
 *
 * @param {string} deviceId
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Object} The device record (created if new).
 */
function updateDeviceLocation(deviceId, latitude, longitude) {
  const now = new Date().toISOString();
  const existing = getDeviceById(deviceId);

  if (existing) {
    getDb().prepare(`
      UPDATE devices SET latitude = @latitude, longitude = @longitude, updated_at = @updatedAt
      WHERE device_id = @deviceId
    `).run({ deviceId, latitude, longitude, updatedAt: now });
  } else {
    getDb().prepare(`
      INSERT INTO devices (device_id, latitude, longitude, created_at, updated_at)
      VALUES (@deviceId, @latitude, @longitude, @createdAt, @updatedAt)
    `).run({ deviceId, latitude, longitude, createdAt: now, updatedAt: now });
  }

  return getDeviceById(deviceId);
}

/**
 * Reset a device to its initial/default state.
 *
 * @param {string} deviceId
 * @returns {Object} The reset device record (created if new).
 */
function resetDevice(deviceId) {
  const now = new Date().toISOString();
  const existing = getDeviceById(deviceId);

  if (existing) {
    getDb().prepare(`
      UPDATE devices SET
        battery_level = 82,
        network_status = 'ONLINE',
        device_state = 'IDLE',
        latitude = NULL,
        longitude = NULL,
        last_heartbeat = NULL,
        updated_at = @updatedAt
      WHERE device_id = @deviceId
    `).run({ deviceId, updatedAt: now });
  } else {
    getDb().prepare(`
      INSERT INTO devices (
        device_id, battery_level, network_status, device_state,
        created_at, updated_at
      ) VALUES (@deviceId, 82, 'ONLINE', 'IDLE', @createdAt, @updatedAt)
    `).run({ deviceId, createdAt: now, updatedAt: now });
  }

  return getDeviceById(deviceId);
}

// -------------------------------------------
//  Evidence CRUD Operations
// -------------------------------------------

/**
 * Insert a new evidence record.
 *
 * @param {Object} data
 * @param {string} data.alertId - Required. FK to alerts.alert_id.
 * @param {string} data.evidenceType - One of EVIDENCE_TYPES.
 * @param {string} data.filePath - Server path to the stored file.
 * @param {string} [data.sha256Hash] - SHA-256 integrity hash of the file.
 * @param {number} [data.fileSize] - File size in bytes.
 * @param {string} [data.mimeType] - MIME type (e.g. 'audio/webm').
 * @param {string} [data.description] - Optional human-readable note.
 * @returns {Object} The created evidence record.
 */
function insertEvidence(data) {
  const evidenceId = randomUUID();
  const uploadedAt = new Date().toISOString();

  getDb().prepare(`
    INSERT INTO evidence (
      evidence_id, alert_id, evidence_type, file_path,
      sha256_hash, file_size, mime_type, description, uploaded_at
    ) VALUES (
      @evidenceId, @alertId, @evidenceType, @filePath,
      @sha256Hash, @fileSize, @mimeType, @description, @uploadedAt
    )
  `).run({
    evidenceId,
    alertId: data.alertId,
    evidenceType: data.evidenceType,
    filePath: data.filePath,
    sha256Hash: data.sha256Hash || null,
    fileSize: data.fileSize ?? null,
    mimeType: data.mimeType || null,
    description: data.description || null,
    uploadedAt,
  });

  return getEvidenceById(evidenceId);
}

/**
 * Get a single evidence record by its ID.
 * @param {string} evidenceId
 * @returns {Object|null}
 */
function getEvidenceById(evidenceId) {
  return getDb()
    .prepare('SELECT * FROM evidence WHERE evidence_id = ?')
    .get(evidenceId) || null;
}

/**
 * Get all evidence records for a given alert, optionally filtered by type.
 * @param {string} alertId
 * @param {Object} [options]
 * @param {string} [options.type] - Filter by evidence_type.
 * @param {number} [options.limit] - Max results (default 50).
 * @param {number} [options.offset] - Pagination offset.
 * @returns {Object[]}
 */
function getEvidenceByAlertId(alertId, options = {}) {
  const conditions = ['alert_id = ?'];
  const params = [alertId];

  if (options.type) {
    conditions.push('evidence_type = ?');
    params.push(options.type);
  }

  const limit = options.limit || 50;
  const offset = options.offset || 0;

  return getDb()
    .prepare(
      `SELECT * FROM evidence
       WHERE ${conditions.join(' AND ')}
       ORDER BY uploaded_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);
}

/**
 * Get the first (most recent) evidence record of a specific type for an alert.
 * Useful when you expect a single recording per alert.
 * @param {string} alertId
 * @param {string} type - One of EVIDENCE_TYPES values.
 * @returns {Object|null}
 */
function getEvidenceByAlertIdAndType(alertId, type) {
  return getDb()
    .prepare(
      'SELECT * FROM evidence WHERE alert_id = ? AND evidence_type = ? ORDER BY uploaded_at DESC LIMIT 1'
    )
    .get(alertId, type) || null;
}

/**
 * Delete a single evidence record and return it (for cleanup).
 * Does NOT delete the actual file from disk — caller is responsible.
 * @param {string} evidenceId
 * @returns {Object|null} The deleted record, or null if not found.
 */
function deleteEvidence(evidenceId) {
  const record = getEvidenceById(evidenceId);
  if (!record) return null;

  getDb().prepare('DELETE FROM evidence WHERE evidence_id = ?').run(evidenceId);
  return record;
}

/**
 * Delete all evidence records for a given alert.
 * Returns the count of deleted records.
 * Does NOT delete actual files from disk.
 * @param {string} alertId
 * @returns {number} Count of deleted records.
 */
function deleteEvidenceByAlertId(alertId) {
  const result = getDb()
    .prepare('DELETE FROM evidence WHERE alert_id = ?')
    .run(alertId);
  return result.changes;
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
  EVENT_TYPES,
  EVIDENCE_TYPES,

  // Alert operations
  insertAlert,
  getAlertById,
  getAlerts,
  updateAlert,
  transitionAlertStatus,

  // Incident event (timeline) operations
  insertIncidentEvent,
  getIncidentEvents,

  // Device operations
  getDeviceById,
  upsertDeviceFromHeartbeat,
  updateDeviceLocation,
  resetDevice,

  // Evidence operations
  insertEvidence,
  getEvidenceById,
  getEvidenceByAlertId,
  getEvidenceByAlertIdAndType,
  deleteEvidence,
  deleteEvidenceByAlertId,
};
