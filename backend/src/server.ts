import { createServer } from 'node:http';
import cors from 'cors';
import express, { type Response } from 'express';
import { Server as SocketServer } from 'socket.io';
import {
  AcknowledgeIncidentPayloadSchema,
  CancelIncidentPayloadSchema,
  EmergencyEventSchema,
  ResolveIncidentPayloadSchema,
  UpdateResponderAvailabilityPayloadSchema,
} from '@netri/contracts';
import { NetriStore } from './store.js';

const port = Number(process.env.PORT ?? 4000);
const store = new NetriStore();
const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, { cors: { origin: true, credentials: false } });

app.use(cors());
app.use(express.json({ limit: '32kb' }));

function sendError(response: Response, status: number, message: string): void {
  response.status(status).json({ error: message });
}

function broadcastState(): void {
  io.emit('overview.updated', store.getOverview());
  io.emit('devices.updated', store.listDevices());
  io.emit('responders.updated', store.listResponders());
}

app.get('/health', (_request, response) => {
  response.json({ service: 'netri-backend', status: 'ok', simulated: true, now: new Date().toISOString() });
});

app.get('/api/overview', (_request, response) => response.json(store.getOverview()));
app.get('/api/devices', (_request, response) => response.json(store.listDevices()));
app.get('/api/employees', (_request, response) => response.json(store.listEmployees()));
app.get('/api/contacts', (_request, response) => response.json(store.listContacts()));
app.get('/api/responders', (_request, response) => response.json(store.listResponders()));
app.get('/api/incidents', (request, response) => {
  const limit = Math.min(100, Math.max(1, Number(request.query.limit ?? 50)));
  response.json(store.listIncidents(Number.isFinite(limit) ? limit : 50));
});
app.get('/api/incidents/:incidentId', (request, response) => {
  const details = store.getIncidentDetails(request.params.incidentId);
  if (!details) return sendError(response, 404, 'Incident not found.');
  return response.json(details);
});

app.post('/api/events/emergency', (request, response) => {
  const parsed = EmergencyEventSchema.safeParse(request.body);
  if (!parsed.success) return sendError(response, 400, 'Invalid emergency event payload.');
  const result = store.createIncident(parsed.data);
  io.emit(result.duplicate ? 'incident.updated' : 'incident.created', result.incident);
  if (!result.duplicate) io.emit('incident.timeline', store.getIncidentDetails(result.incident.incidentId)?.timeline ?? []);
  broadcastState();
  return response.status(result.duplicate ? 200 : 201).json(result.incident);
});

app.post('/api/incidents/:incidentId/acknowledge', (request, response) => {
  const parsed = AcknowledgeIncidentPayloadSchema.safeParse(request.body);
  if (!parsed.success) return sendError(response, 400, 'A responder ID is required.');
  const incident = store.acknowledgeIncident(request.params.incidentId, parsed.data.responderId);
  if (!incident) return sendError(response, 409, 'Incident cannot be acknowledged in its current state.');
  io.emit('incident.updated', incident);
  io.emit('incident.timeline', store.getIncidentDetails(incident.incidentId)?.timeline ?? []);
  broadcastState();
  return response.json(incident);
});

app.post('/api/incidents/:incidentId/resolve', (request, response) => {
  const parsed = ResolveIncidentPayloadSchema.safeParse(request.body);
  if (!parsed.success) return sendError(response, 400, 'A responder ID is required.');
  const incident = store.resolveIncident(request.params.incidentId, parsed.data.responderId, parsed.data.notes);
  if (!incident) return sendError(response, 409, 'Only acknowledged incidents can be resolved.');
  io.emit('incident.updated', incident);
  io.emit('incident.timeline', store.getIncidentDetails(incident.incidentId)?.timeline ?? []);
  broadcastState();
  return response.json(incident);
});

app.post('/api/incidents/:incidentId/cancel', (request, response) => {
  const parsed = CancelIncidentPayloadSchema.safeParse(request.body);
  if (!parsed.success) return sendError(response, 400, 'An organization actor ID is required.');
  const incident = store.cancelIncident(request.params.incidentId, parsed.data.actorId, parsed.data.reason);
  if (!incident) return sendError(response, 409, 'Incident is already closed.');
  io.emit('incident.updated', incident);
  io.emit('incident.timeline', store.getIncidentDetails(incident.incidentId)?.timeline ?? []);
  broadcastState();
  return response.json(incident);
});

app.patch('/api/responders/:responderId/availability', (request, response) => {
  const parsed = UpdateResponderAvailabilityPayloadSchema.safeParse(request.body);
  if (!parsed.success) return sendError(response, 400, 'A valid availability state is required.');
  const responder = store.updateResponderAvailability(request.params.responderId, parsed.data.availabilityState);
  if (!responder) return sendError(response, 404, 'Responder not found.');
  io.emit('responder.updated', responder);
  broadcastState();
  return response.json(responder);
});

io.on('connection', (socket) => {
  socket.emit('overview.updated', store.getOverview());
  socket.emit('devices.updated', store.listDevices());
  socket.emit('responders.updated', store.listResponders());
  socket.emit('incidents.updated', store.listIncidents());
});

setInterval(() => {
  for (const incident of store.escalateDueIncidents()) {
    io.emit('incident.updated', incident);
    io.emit('incident.timeline', store.getIncidentDetails(incident.incidentId)?.timeline ?? []);
  }
  broadcastState();
}, 5_000).unref();

httpServer.listen(port, () => {
  console.log(`NETRI backend listening on http://localhost:${port}`);
  console.log('Persistence: SQLite via node:sqlite · transport: simulated BLE boundary');
});

process.on('SIGINT', () => {
  store.close();
  httpServer.close(() => process.exit(0));
});
