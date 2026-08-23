// =============================================
//  Project-NETRI — Device REST API
//  Mounted at /api/device
// =============================================

const { Router } = require('express');
const {
  getDeviceById,
  upsertDeviceFromHeartbeat,
  updateDeviceLocation,
  resetDevice,
} = require('../db');

const router = Router();

// -------------------------------------------
//  Validation Helpers
// -------------------------------------------

/**
 * Validate that a deviceId is a non-empty string.
 */
function isValidDeviceId(id) {
  return typeof id === 'string' && id.trim().length > 0;
}

/**
 * Validate latitude: must be a number between -90 and 90.
 */
function isValidLatitude(lat) {
  if (lat === undefined || lat === null) return true;
  const n = Number(lat);
  return !Number.isNaN(n) && n >= -90 && n <= 90;
}

/**
 * Validate longitude: must be a number between -180 and 180.
 */
function isValidLongitude(lng) {
  if (lng === undefined || lng === null) return true;
  const n = Number(lng);
  return !Number.isNaN(n) && n >= -180 && n <= 180;
}

/**
 * Validate battery: must be an integer 0-100 if provided.
 */
function isValidBattery(battery) {
  if (battery === undefined || battery === null) return true;
  const n = Number(battery);
  return Number.isInteger(n) && n >= 0 && n <= 100;
}

// ===========================================
//  1. HEARTBEAT
//  POST /api/device/:deviceId/heartbeat
//
//  Receives periodic device status reports.
//  Creates the device row if it doesn't exist.
//
//  Body (matches simulator.js):
//  {
//    "device_id": "SAFE-COMPACT-001",
//    "timestamp": "2026-08-23T...",
//    "battery": 82,
//    "network": "ONLINE",
//    "state": "IDLE",
//    "latitude": 19.076,
//    "longitude": 72.8777
//  }
// ===========================================

router.post('/:deviceId/heartbeat', (req, res) => {
  const { deviceId } = req.params;

  if (!isValidDeviceId(deviceId)) {
    return res.status(400).json({ error: { message: 'Invalid deviceId' } });
  }

  const body = req.body || {};

  if (!isValidLatitude(body.latitude)) {
    return res.status(400).json({ error: { message: 'latitude must be between -90 and 90' } });
  }

  if (!isValidLongitude(body.longitude)) {
    return res.status(400).json({ error: { message: 'longitude must be between -180 and 180' } });
  }

  if (!isValidBattery(body.battery)) {
    return res.status(400).json({ error: { message: 'battery must be an integer between 0 and 100' } });
  }

  try {
    const device = upsertDeviceFromHeartbeat(deviceId, {
      battery: body.battery ?? null,
      network: body.network || null,
      state: body.state || null,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      timestamp: body.timestamp || null,
    });

    return res.status(200).json({ device });
  } catch (err) {
    console.error('[Devices] Heartbeat error:', err.message);
    return res.status(500).json({ error: { message: 'Failed to process heartbeat' } });
  }
});

// ===========================================
//  2. STATUS
//  GET /api/device/:deviceId/status
//
//  Returns the latest known state for a device.
// ===========================================

router.get('/:deviceId/status', (req, res) => {
  const { deviceId } = req.params;

  if (!isValidDeviceId(deviceId)) {
    return res.status(400).json({ error: { message: 'Invalid deviceId' } });
  }

  try {
    const device = getDeviceById(deviceId);

    if (!device) {
      return res.status(404).json({ error: { message: `Device not found: ${deviceId}` } });
    }

    return res.json({ device });
  } catch (err) {
    console.error('[Devices] Status error:', err.message);
    return res.status(500).json({ error: { message: 'Failed to retrieve device status' } });
  }
});

// ===========================================
//  3. RESET
//  POST /api/device/:deviceId/reset
//
//  Resets the device to initial/default state.
//
//  Body (matches simulator.js):
//  {
//    "device_id": "SAFE-COMPACT-001",
//    "timestamp": "2026-08-23T...",
//    "reason": "MANUAL_RESET"
//  }
// ===========================================

router.post('/:deviceId/reset', (req, res) => {
  const { deviceId } = req.params;

  if (!isValidDeviceId(deviceId)) {
    return res.status(400).json({ error: { message: 'Invalid deviceId' } });
  }

  try {
    const device = resetDevice(deviceId);

    console.log(`[Devices] Reset device ${deviceId} — reason: ${req.body?.reason || 'unknown'}`);

    return res.json({ device, message: 'Device reset to initial state' });
  } catch (err) {
    console.error('[Devices] Reset error:', err.message);
    return res.status(500).json({ error: { message: 'Failed to reset device' } });
  }
});

// ===========================================
//  4. LOCATION
//  POST /api/device/:deviceId/location
//
//  Updates the device's GPS coordinates.
//  (Defined for future use — not actively called
//   by the simulator yet, but ready.)
// ===========================================

router.post('/:deviceId/location', (req, res) => {
  const { deviceId } = req.params;

  if (!isValidDeviceId(deviceId)) {
    return res.status(400).json({ error: { message: 'Invalid deviceId' } });
  }

  const { latitude, longitude } = req.body || {};

  if (!isValidLatitude(latitude)) {
    return res.status(400).json({ error: { message: 'latitude must be between -90 and 90' } });
  }

  if (!isValidLongitude(longitude)) {
    return res.status(400).json({ error: { message: 'longitude must be between -180 and 180' } });
  }

  if (latitude == null || longitude == null) {
    return res.status(400).json({ error: { message: 'latitude and longitude are required' } });
  }

  try {
    const device = updateDeviceLocation(deviceId, Number(latitude), Number(longitude));
    return res.json({ device });
  } catch (err) {
    console.error('[Devices] Location error:', err.message);
    return res.status(500).json({ error: { message: 'Failed to update device location' } });
  }
});

// -------------------------------------------
//  Export the router
// -------------------------------------------

module.exports = router;
