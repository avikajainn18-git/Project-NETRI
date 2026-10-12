import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  type DeviceState,
  DeviceStateSchema,
  type EmergencyEvent,
  type Employee,
  EmployeeSchema,
  type EmergencyContact,
  EmergencyContactSchema,
  type Incident,
  IncidentSchema,
  type IncidentTimelineEntry,
  IncidentTimelineEntrySchema,
  type Responder,
  ResponderSchema,
  type Severity,
} from '@netri/contracts';

export interface Overview {
  activeIncidents: number;
  escalatedIncidents: number;
  operationalDevices: number;
  connectedDevices: number;
  availableResponders: number;
  totalResponders: number;
  lastEventAt: string | null;
}

export interface IncidentDetails {
  incident: Incident;
  timeline: IncidentTimelineEntry[];
  employee: Employee | null;
  responder: Responder | null;
}

const DEFAULT_DB_PATH = resolve(process.env.NETRI_DB_PATH ?? './data/netri.db');

function nowIso(): string {
  return new Date().toISOString();
}

function asRecord(row: unknown): Record<string, unknown> {
  return row as Record<string, unknown>;
}

export class NetriStore {
  private readonly db: DatabaseSync;

  constructor(dbPath = DEFAULT_DB_PATH) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS employees (
        employee_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        device_id TEXT NOT NULL UNIQUE,
        assigned_location TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS contacts (
        contact_id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL REFERENCES employees(employee_id),
        name TEXT NOT NULL,
        relationship TEXT NOT NULL,
        phone_number TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS devices (
        device_id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL REFERENCES employees(employee_id),
        device_state TEXT NOT NULL,
        ble_state TEXT NOT NULL,
        current_zone TEXT NOT NULL,
        last_seen_at TEXT
      );
      CREATE TABLE IF NOT EXISTS responders (
        responder_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        department TEXT NOT NULL,
        availability_state TEXT NOT NULL,
        active_incident_id TEXT,
        available_since TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS incidents (
        incident_id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        location_zone TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        assigned_responder_id TEXT,
        escalation_state TEXT NOT NULL,
        acknowledged_at TEXT,
        resolved_at TEXT,
        cancelled_at TEXT,
        dedup_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS incident_timeline (
        timeline_id TEXT PRIMARY KEY,
        incident_id TEXT NOT NULL REFERENCES incidents(incident_id),
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        actor_id TEXT,
        created_at TEXT NOT NULL
      );
    `);
    this.seed();
  }

  close(): void {
    this.db.close();
  }

  listDevices(): DeviceState[] {
    const rows = this.db.prepare('SELECT * FROM devices ORDER BY device_id').all();
    return rows.map((row) => DeviceStateSchema.parse({
      deviceId: asRecord(row).device_id,
      deviceState: asRecord(row).device_state,
      bleState: asRecord(row).ble_state,
      currentZone: asRecord(row).current_zone,
      employeeId: asRecord(row).employee_id,
      lastSeenAt: asRecord(row).last_seen_at,
    }));
  }

  listEmployees(): Employee[] {
    const rows = this.db.prepare('SELECT * FROM employees ORDER BY name').all();
    return rows.map((row) => this.employeeFromRow(asRecord(row)));
  }

  listContacts(): Array<EmergencyContact & { employeeId: string; employeeName: string }> {
    const rows = this.db.prepare(`
      SELECT c.*, e.name AS employee_name
      FROM contacts c JOIN employees e ON e.employee_id = c.employee_id
      ORDER BY e.name, c.name
    `).all();
    return rows.map((row) => {
      const record = asRecord(row);
      return {
        ...EmergencyContactSchema.parse({
          contactId: record.contact_id,
          name: record.name,
          relationship: record.relationship,
          phoneNumber: record.phone_number,
        }),
        employeeId: String(record.employee_id),
        employeeName: String(record.employee_name),
      };
    });
  }

  listResponders(): Responder[] {
    const rows = this.db.prepare('SELECT * FROM responders ORDER BY name').all();
    return rows.map((row) => this.responderFromRow(asRecord(row)));
  }

  listIncidents(limit = 50): Incident[] {
    const rows = this.db.prepare('SELECT * FROM incidents ORDER BY created_at DESC LIMIT ?').all(limit);
    return rows.map((row) => this.incidentFromRow(asRecord(row)));
  }

  getIncidentDetails(incidentId: string): IncidentDetails | null {
    const incident = this.getIncident(incidentId);
    if (!incident) return null;
    const timelineRows = this.db.prepare(
      'SELECT * FROM incident_timeline WHERE incident_id = ? ORDER BY created_at ASC',
    ).all(incidentId);
    const employeeRow = this.db.prepare('SELECT * FROM employees WHERE employee_id = ?').get(incident.employeeId);
    const responderRow = incident.assignedResponderId
      ? this.db.prepare('SELECT * FROM responders WHERE responder_id = ?').get(incident.assignedResponderId)
      : undefined;
    return {
      incident,
      timeline: timelineRows.map((row) => this.timelineFromRow(asRecord(row))),
      employee: employeeRow ? this.employeeFromRow(asRecord(employeeRow)) : null,
      responder: responderRow ? this.responderFromRow(asRecord(responderRow)) : null,
    };
  }

  getIncident(incidentId: string): Incident | null {
    const row = this.db.prepare('SELECT * FROM incidents WHERE incident_id = ?').get(incidentId);
    return row ? this.incidentFromRow(asRecord(row)) : null;
  }

  getOverview(): Overview {
    const count = (sql: string): number => Number((this.db.prepare(sql).get() as { count: number }).count);
    const last = this.db.prepare('SELECT MAX(created_at) AS last_event FROM incidents').get() as { last_event: string | null };
    return {
      activeIncidents: count("SELECT COUNT(*) AS count FROM incidents WHERE status IN ('ACTIVE', 'ASSIGNED', 'ACKNOWLEDGED')"),
      escalatedIncidents: count("SELECT COUNT(*) AS count FROM incidents WHERE escalation_state = 'ESCALATED'"),
      operationalDevices: count("SELECT COUNT(*) AS count FROM devices WHERE device_state = 'OPERATIONAL'"),
      connectedDevices: count("SELECT COUNT(*) AS count FROM devices WHERE ble_state = 'CONNECTED'"),
      availableResponders: count("SELECT COUNT(*) AS count FROM responders WHERE availability_state = 'AVAILABLE'"),
      totalResponders: count('SELECT COUNT(*) AS count FROM responders'),
      lastEventAt: last.last_event,
    };
  }

  createIncident(event: EmergencyEvent): { incident: Incident; duplicate: boolean } {
    const recent = this.db.prepare(`
      SELECT * FROM incidents
      WHERE device_id = ? AND status IN ('ACTIVE', 'ASSIGNED', 'ACKNOWLEDGED')
      ORDER BY created_at DESC LIMIT 1
    `).get(event.deviceId);
    if (recent) {
      const existing = this.incidentFromRow(asRecord(recent));
      const ageMs = Date.now() - Date.parse(existing.createdAt);
      if (ageMs <= 30_000) {
        const updatedAt = nowIso();
        this.db.prepare('UPDATE incidents SET dedup_count = dedup_count + 1, updated_at = ? WHERE incident_id = ?')
          .run(updatedAt, existing.incidentId);
        this.addTimeline(existing.incidentId, 'DUPLICATE_RECEIVED', 'Duplicate device event suppressed by the incident engine.', null, updatedAt);
        const updated = this.getIncident(existing.incidentId)!;
        return { incident: updated, duplicate: true };
      }
    }

    const createdAt = event.occurredAt;
    const incidentId = `INC-${new Date(createdAt).toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const assigned = this.db.prepare(`
      SELECT responder_id FROM responders
      WHERE availability_state = 'AVAILABLE'
      ORDER BY available_since ASC LIMIT 1
    `).get() as { responder_id: string } | undefined;
    const assignedResponderId = assigned?.responder_id ?? null;
    const status = assignedResponderId ? 'ASSIGNED' : 'ACTIVE';
    const updatedAt = nowIso();
    this.db.prepare(`
      INSERT INTO incidents (
        incident_id, event_id, device_id, employee_id, location_zone, severity, status,
        created_at, updated_at, assigned_responder_id, escalation_state,
        acknowledged_at, resolved_at, cancelled_at, dedup_count
      ) VALUES (?, ?, ?, ?, ?, 'MEDIUM', ?, ?, ?, ?, 'MONITORED', NULL, NULL, NULL, 0)
    `).run(incidentId, event.eventId, event.deviceId, event.employeeId, event.locationZone, status, createdAt, updatedAt, assignedResponderId);
    this.setDeviceOnline(event.deviceId, event.occurredAt);
    this.addTimeline(incidentId, 'CREATED', `Emergency trigger received from ${event.deviceId}.`, null, createdAt);
    if (assignedResponderId) {
      this.db.prepare("UPDATE responders SET availability_state = 'BUSY', active_incident_id = ? WHERE responder_id = ?")
        .run(incidentId, assignedResponderId);
      this.addTimeline(incidentId, 'ASSIGNED', `Automatically assigned to ${assignedResponderId}.`, 'SYSTEM', updatedAt);
    }
    return { incident: this.getIncident(incidentId)!, duplicate: false };
  }

  acknowledgeIncident(incidentId: string, responderId: string): Incident | null {
    const incident = this.getIncident(incidentId);
    if (!incident || !['ACTIVE', 'ASSIGNED'].includes(incident.status)) return null;
    const updatedAt = nowIso();
    this.db.prepare(`
      UPDATE incidents SET status = 'ACKNOWLEDGED', acknowledged_at = ?, updated_at = ?,
      escalation_state = 'STOPPED', assigned_responder_id = COALESCE(assigned_responder_id, ?)
      WHERE incident_id = ?
    `).run(updatedAt, updatedAt, responderId, incidentId);
    this.db.prepare("UPDATE responders SET availability_state = 'BUSY', active_incident_id = ? WHERE responder_id = ?")
      .run(incidentId, responderId);
    this.addTimeline(incidentId, 'ACKNOWLEDGED', 'Responder acknowledged the incident. Escalation stopped.', responderId, updatedAt);
    return this.getIncident(incidentId);
  }

  resolveIncident(incidentId: string, responderId: string, notes?: string): Incident | null {
    const incident = this.getIncident(incidentId);
    if (!incident || incident.status !== 'ACKNOWLEDGED') return null;
    const updatedAt = nowIso();
    this.db.prepare(`
      UPDATE incidents SET status = 'RESOLVED', resolved_at = ?, updated_at = ? WHERE incident_id = ?
    `).run(updatedAt, updatedAt, incidentId);
    this.db.prepare("UPDATE responders SET availability_state = 'AVAILABLE', active_incident_id = NULL, available_since = ? WHERE responder_id = ?")
      .run(updatedAt, responderId);
    this.addTimeline(incidentId, 'RESOLVED', notes?.trim() ? `Incident resolved: ${notes.trim()}` : 'Incident resolved by responder.', responderId, updatedAt);
    return this.getIncident(incidentId);
  }

  cancelIncident(incidentId: string, actorId: string, reason?: string): Incident | null {
    const incident = this.getIncident(incidentId);
    if (!incident || ['RESOLVED', 'CANCELLED'].includes(incident.status)) return null;
    const updatedAt = nowIso();
    this.db.prepare(`
      UPDATE incidents SET status = 'CANCELLED', cancelled_at = ?, updated_at = ?, escalation_state = 'STOPPED' WHERE incident_id = ?
    `).run(updatedAt, updatedAt, incidentId);
    if (incident.assignedResponderId) {
      this.db.prepare("UPDATE responders SET availability_state = 'AVAILABLE', active_incident_id = NULL, available_since = ? WHERE responder_id = ?")
        .run(updatedAt, incident.assignedResponderId);
    }
    this.addTimeline(incidentId, 'CANCELLED', reason?.trim() ? `Cancelled by organization: ${reason.trim()}` : 'Cancelled by organization.', actorId, updatedAt);
    return this.getIncident(incidentId);
  }

  updateResponderAvailability(responderId: string, availabilityState: 'AVAILABLE' | 'BUSY' | 'OFFLINE'): Responder | null {
    const row = this.db.prepare('SELECT * FROM responders WHERE responder_id = ?').get(responderId);
    if (!row) return null;
    const at = nowIso();
    this.db.prepare('UPDATE responders SET availability_state = ?, available_since = ? WHERE responder_id = ?')
      .run(availabilityState, at, responderId);
    return this.listResponders().find((responder) => responder.responderId === responderId) ?? null;
  }

  escalateDueIncidents(): Incident[] {
    const incidents = this.listIncidents(100).filter((incident) =>
      ['ACTIVE', 'ASSIGNED'].includes(incident.status) && incident.escalationState === 'MONITORED',
    );
    const thresholds: Record<Severity, number> = { MEDIUM: 60_000, HIGH: 45_000, CRITICAL: 30_000 };
    const escalated: Incident[] = [];
    for (const incident of incidents) {
      if (Date.now() - Date.parse(incident.createdAt) < thresholds[incident.severity]) continue;
      const updatedAt = nowIso();
      this.db.prepare("UPDATE incidents SET escalation_state = 'ESCALATED', updated_at = ? WHERE incident_id = ?")
        .run(updatedAt, incident.incidentId);
      this.addTimeline(incident.incidentId, 'ESCALATED', `Non-response threshold reached for ${incident.severity.toLowerCase()} priority incident.`, 'SYSTEM', updatedAt);
      escalated.push(this.getIncident(incident.incidentId)!);
    }
    return escalated;
  }

  private setDeviceOnline(deviceId: string, seenAt: string): void {
    this.db.prepare("UPDATE devices SET ble_state = 'CONNECTED', last_seen_at = ? WHERE device_id = ?").run(seenAt, deviceId);
  }

  private addTimeline(
    incidentId: string,
    type: IncidentTimelineEntry['type'],
    message: string,
    actorId: string | null,
    createdAt: string,
  ): void {
    this.db.prepare(`
      INSERT INTO incident_timeline (timeline_id, incident_id, type, message, actor_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), incidentId, type, message, actorId, createdAt);
  }

  private incidentFromRow(row: Record<string, unknown>): Incident {
    return IncidentSchema.parse({
      incidentId: row.incident_id,
      eventId: row.event_id,
      deviceId: row.device_id,
      employeeId: row.employee_id,
      locationZone: row.location_zone,
      severity: row.severity,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      assignedResponderId: row.assigned_responder_id,
      escalationState: row.escalation_state,
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
      cancelledAt: row.cancelled_at,
      dedupCount: row.dedup_count,
    });
  }

  private timelineFromRow(row: Record<string, unknown>): IncidentTimelineEntry {
    return IncidentTimelineEntrySchema.parse({
      timelineId: row.timeline_id,
      incidentId: row.incident_id,
      type: row.type,
      message: row.message,
      actorId: row.actor_id,
      createdAt: row.created_at,
    });
  }

  private employeeFromRow(row: Record<string, unknown>): Employee {
    const contacts = this.db.prepare('SELECT * FROM contacts WHERE employee_id = ? ORDER BY name').all(String(row.employee_id));
    return EmployeeSchema.parse({
      employeeId: row.employee_id,
      name: row.name,
      deviceId: row.device_id,
      assignedLocation: row.assigned_location,
      emergencyContacts: contacts.map((contact) => {
        const record = asRecord(contact);
        return EmergencyContactSchema.parse({
          contactId: record.contact_id,
          name: record.name,
          relationship: record.relationship,
          phoneNumber: record.phone_number,
        });
      }),
    });
  }

  private responderFromRow(row: Record<string, unknown>): Responder {
    return ResponderSchema.parse({
      responderId: row.responder_id,
      name: row.name,
      department: row.department,
      availabilityState: row.availability_state,
      activeIncidentId: row.active_incident_id,
    });
  }

  private seed(): void {
    const employeeCount = Number((this.db.prepare('SELECT COUNT(*) AS count FROM employees').get() as { count: number }).count);
    if (employeeCount > 0) return;
    const employees = [
      ['EMP-1042', 'Aarav Sharma', 'NETRI-001', 'Library'],
      ['EMP-1088', 'Mira Kapoor', 'NETRI-002', 'Engineering Lab'],
      ['EMP-1116', 'Rohan Iyer', 'NETRI-003', 'Hostel 2'],
    ];
    const insertEmployee = this.db.prepare('INSERT INTO employees VALUES (?, ?, ?, ?)');
    const insertContact = this.db.prepare('INSERT INTO contacts VALUES (?, ?, ?, ?, ?)');
    const insertDevice = this.db.prepare('INSERT INTO devices VALUES (?, ?, ?, ?, ?, ?)');
    for (const employee of employees) insertEmployee.run(...employee);
    insertContact.run('CON-1042-01', 'EMP-1042', 'Ananya Sharma', 'Sister', '+91 98765 10420');
    insertContact.run('CON-1088-01', 'EMP-1088', 'Vikram Kapoor', 'Father', '+91 98765 10880');
    insertContact.run('CON-1116-01', 'EMP-1116', 'Nisha Iyer', 'Mother', '+91 98765 11160');
    insertDevice.run('NETRI-001', 'EMP-1042', 'OPERATIONAL', 'CONNECTED', 'Library', nowIso());
    insertDevice.run('NETRI-002', 'EMP-1088', 'OPERATIONAL', 'DISCONNECTED', 'Engineering Lab', null);
    insertDevice.run('NETRI-003', 'EMP-1116', 'OPERATIONAL', 'CONNECTED', 'Hostel 2', nowIso());
    const insertResponder = this.db.prepare('INSERT INTO responders VALUES (?, ?, ?, ?, ?, ?)');
    const availableAt = new Date(Date.now() - 10 * 60_000).toISOString();
    insertResponder.run('RSP-01', 'Ava Nair', 'Campus Response', 'AVAILABLE', null, availableAt);
    insertResponder.run('RSP-02', 'Dev Mehta', 'Campus Response', 'AVAILABLE', null, new Date(Date.now() - 5 * 60_000).toISOString());
    insertResponder.run('RSP-03', 'Kiara Shah', 'Facilities Security', 'BUSY', 'TRAINING-01', nowIso());
  }
}
