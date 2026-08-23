// =============================================
//  Project-NETRI — Evidence REST API
//  Handles audio/video evidence upload, storage,
//  retrieval, and integrity verification.
//
//  Mount points (set in server.js):
//    /api/alerts/:alertId/evidence  — alert-scoped routes
//    /api/evidence                  — standalone evidence routes
// =============================================

const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const {
  getAlertById,
  insertEvidence,
  getEvidenceById,
  getEvidenceByAlertId,
  deleteEvidence,
  insertIncidentEvent,
  EVENT_TYPES,
  EVIDENCE_TYPES,
} = require('../db');
const { emit } = require('../services/socket');

// -------------------------------------------
//  Configuration
// -------------------------------------------

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'evidence');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// MIME types accepted from the browser's MediaRecorder API.
// Covers all major browsers and formats.
const ALLOWED_MIME_TYPES = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg',
  'audio/ogg;codecs=opus',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'video/webm',
  'video/ogg',
]);

// -------------------------------------------
//  Multer — disk storage with UUID filenames
// -------------------------------------------

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename(_req, file, cb) {
    const uniqueName = `${crypto.randomUUID()}${path.extname(file.originalname) || '.webm'}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}. Accepted: ${Array.from(ALLOWED_MIME_TYPES).join(', ')}`));
    }
  },
});

// -------------------------------------------
//  Validation Helpers
// -------------------------------------------

function isValidAlertId(id) {
  return typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function computeSha256(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ===========================================
//  ALERT-SCOPED ROUTES
//  Mounted at /api/alerts/:alertId/evidence
// ===========================================

const alertRouter = Router({ mergeParams: true });

// ------------------------------------------
//  1. UPLOAD AUDIO EVIDENCE
//  POST /api/alerts/:alertId/evidence/audio
//
//  Body: multipart/form-data
//    - file: audio file (required)
//    - description: optional text
//
//  Response: { evidence: { ...record } }
// ------------------------------------------

alertRouter.post('/:alertId/evidence/audio', (req, res) => {
  const { alertId } = req.params;

  if (!isValidAlertId(alertId)) {
    return res.status(400).json({ error: { message: 'Invalid alertId format — must be a valid UUID' } });
  }

  // Verify the alert exists
  const alert = getAlertById(alertId);
  if (!alert) {
    return res.status(404).json({ error: { message: `Alert not found: ${alertId}` } });
  }

  // Process upload — multer middleware handles file validation
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: { message: `File too large — maximum size is ${MAX_FILE_SIZE / (1024 * 1024)} MB` } });
        }
        return res.status(400).json({ error: { message: `Upload error: ${err.message}` } });
      }
      // Custom fileFilter error
      return res.status(400).json({ error: { message: err.message } });
    }

    if (!req.file) {
      return res.status(400).json({ error: { message: 'No audio file provided. Send a file with field name "file".' } });
    }

    try {
      // Compute SHA-256 hash of the stored file
      const sha256Hash = computeSha256(req.file.path);

      // Store evidence metadata in the database
      const evidence = insertEvidence({
        alertId,
        evidenceType: EVIDENCE_TYPES.AUDIO,
        filePath: req.file.path,
        sha256Hash,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        description: req.body?.description || `Audio recording — ${req.file.originalname}`,
      });

      // Log timeline event
      insertIncidentEvent(
        alertId,
        EVENT_TYPES.STATUS_CHANGED,
        'Audio evidence uploaded',
        {
          evidenceId: evidence.evidence_id,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
          sha256Hash,
        }
      );

      // Broadcast to connected clients
      emit('evidence:uploaded', {
        alert_id: alertId,
        evidence_id: evidence.evidence_id,
        evidence_type: 'AUDIO',
        mime_type: req.file.mimetype,
        file_size: req.file.size,
      });

      console.log(`[Evidence] Audio uploaded — ${evidence.evidence_id} for alert ${alertId} (${req.file.size} bytes, SHA-256: ${sha256Hash.substring(0, 16)}...)`);

      return res.status(201).json({ evidence });
    } catch (dbErr) {
      console.error('[Evidence] Database error after upload:', dbErr.message);
      // Attempt to clean up the stored file
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(500).json({ error: { message: 'Failed to store evidence metadata' } });
    }
  });
});

// ------------------------------------------
//  2. LIST EVIDENCE FOR AN ALERT
//  GET /api/alerts/:alertId/evidence
//
//  Query params:
//    - type: filter by evidence_type
//    - limit: max results (default 50)
//    - offset: pagination offset
//
//  Response: { alert_id, evidence: [...], count }
// ------------------------------------------

alertRouter.get('/:alertId/evidence', (req, res) => {
  const { alertId } = req.params;

  if (!isValidAlertId(alertId)) {
    return res.status(400).json({ error: { message: 'Invalid alertId format — must be a valid UUID' } });
  }

  const alert = getAlertById(alertId);
  if (!alert) {
    return res.status(404).json({ error: { message: `Alert not found: ${alertId}` } });
  }

  const options = {};
  if (req.query.type) {
    options.type = req.query.type.toUpperCase();
  }
  if (req.query.limit) {
    options.limit = parseInt(req.query.limit, 10);
  }
  if (req.query.offset) {
    options.offset = parseInt(req.query.offset, 10);
  }

  const evidence = getEvidenceByAlertId(alertId, options);
  return res.json({ alert_id: alertId, evidence, count: evidence.length });
});

// ------------------------------------------
//  3. GET EVIDENCE METADATA
//  GET /api/evidence/:evidenceId
//
//  Response: { evidence: { ...record } }
// ------------------------------------------

alertRouter.get('/:evidenceId', (req, res) => {
  const { evidenceId } = req.params;

  // This route is only reached for paths that don't match
  // /:alertId/evidence or /:alertId/evidence/audio
  // Since alertIds are UUIDs and evidenceIds are UUIDs,
  // we need the standalone router for this.
  // This block serves as a fallback — the main metadata
  // endpoint is on the standalone router below.
  return res.status(404).json({ error: { message: 'Use GET /api/evidence/:evidenceId for metadata' } });
});

// ------------------------------------------
//  4. GET EVIDENCE FILE (download)
//  GET /api/evidence/:evidenceId/file
//
//  Serves the actual stored audio file.
// ------------------------------------------

alertRouter.get('/:evidenceId/file', (req, res) => {
  return res.status(404).json({ error: { message: 'Use GET /api/evidence/:evidenceId/file for download' } });
});

// ===========================================
//  STANDALONE EVIDENCE ROUTES
//  Mounted at /api/evidence
// ===========================================

const standaloneRouter = Router();

// ------------------------------------------
//  GET EVIDENCE METADATA
//  GET /api/evidence/:evidenceId
// ------------------------------------------

standaloneRouter.get('/:evidenceId', (req, res) => {
  const { evidenceId } = req.params;

  const evidence = getEvidenceById(evidenceId);
  if (!evidence) {
    return res.status(404).json({ error: { message: `Evidence not found: ${evidenceId}` } });
  }

  return res.json({ evidence });
});

// ------------------------------------------
//  GET EVIDENCE FILE (download)
//  GET /api/evidence/:evidenceId/file
//
//  Serves the actual stored file with correct
//  Content-Type and Content-Disposition.
// ------------------------------------------

standaloneRouter.get('/:evidenceId/file', (req, res) => {
  const { evidenceId } = req.params;

  const evidence = getEvidenceById(evidenceId);
  if (!evidence) {
    return res.status(404).json({ error: { message: `Evidence not found: ${evidenceId}` } });
  }

  // Verify file exists on disk
  if (!fs.existsSync(evidence.file_path)) {
    return res.status(404).json({ error: { message: 'Evidence file not found on server' } });
  }

  // Determine filename for download
  const filename = path.basename(evidence.file_path);

  // Set appropriate headers
  res.setHeader('Content-Type', evidence.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  if (evidence.file_size) {
    res.setHeader('Content-Length', evidence.file_size);
  }

  // Stream the file
  const stream = fs.createReadStream(evidence.file_path);
  stream.on('error', (err) => {
    console.error('[Evidence] File stream error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: { message: 'Failed to read evidence file' } });
    }
  });
  stream.pipe(res);
});

// -------------------------------------------
//  Exports
// -------------------------------------------

module.exports = { alertRouter, standaloneRouter };
