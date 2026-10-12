import { useEffect, useMemo, useState, type JSX } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Incident, IncidentTimelineEntry, Responder } from '@netri/contracts';

const API_URL = (import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const OPERATOR_ID = 'RSP-01';

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options?.headers },
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

function upsertIncident(current: Incident[], next: Incident): Incident[] {
  const without = current.filter((incident) => incident.incidentId !== next.incidentId);
  return [next, ...without].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export default function App(): JSX.Element {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [responders, setResponders] = useState<Responder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<IncidentTimelineEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetchJson<Incident[]>('/api/incidents'),
      fetchJson<Responder[]>('/api/responders'),
    ]).then(([nextIncidents, nextResponders]) => {
      if (!mounted) return;
      setIncidents(nextIncidents);
      setResponders(nextResponders);
      setSelectedId(nextIncidents.find((incident) => !['RESOLVED', 'CANCELLED'].includes(incident.status))?.incidentId ?? nextIncidents[0]?.incidentId ?? null);
    }).catch(() => mounted && setError('Backend unavailable. Start the NETRI backend to receive live incidents.'))
      .finally(() => mounted && setLoading(false));
    const socket: Socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('incidents.updated', (next: Incident[]) => setIncidents(next));
    socket.on('incident.created', (next: Incident) => { setIncidents((current) => upsertIncident(current, next)); setSelectedId(next.incidentId); });
    socket.on('incident.updated', (next: Incident) => setIncidents((current) => upsertIncident(current, next)));
    socket.on('incident.timeline', (next: IncidentTimelineEntry[]) => setTimeline(next));
    socket.on('responders.updated', (next: Responder[]) => setResponders(next));
    return () => { mounted = false; socket.close(); };
  }, []);

  const selectedIncident = incidents.find((incident) => incident.incidentId === selectedId) ?? null;
  const operator = responders.find((responder) => responder.responderId === OPERATOR_ID) ?? responders[0] ?? null;
  const activeIncidents = useMemo(() => incidents.filter((incident) => !['RESOLVED', 'CANCELLED'].includes(incident.status)), [incidents]);

  useEffect(() => {
    if (!selectedId) { setTimeline([]); return; }
    fetchJson<{ timeline: IncidentTimelineEntry[] }>(`/api/incidents/${selectedId}`)
      .then((details) => setTimeline(details.timeline))
      .catch(() => setTimeline([]));
  }, [selectedId]);

  const performAction = async (action: 'acknowledge' | 'resolve') => {
    if (!selectedIncident || !operator || working) return;
    setWorking(true); setError(null);
    try {
      const next = await fetchJson<Incident>(`/api/incidents/${selectedIncident.incidentId}/${action}`, {
        method: 'POST', body: JSON.stringify({ responderId: operator.responderId, ...(action === 'resolve' ? { notes: 'Response completed from the emergency console.' } : {}) }),
      });
      setIncidents((current) => upsertIncident(current, next));
      const details = await fetchJson<{ timeline: IncidentTimelineEntry[] }>(`/api/incidents/${next.incidentId}`);
      setTimeline(details.timeline);
    } catch { setError('That action could not be completed. Refresh and try again.'); }
    finally { setWorking(false); }
  };

  const updateAvailability = async (availabilityState: Responder['availabilityState']) => {
    if (!operator) return;
    try {
      const next = await fetchJson<Responder>(`/api/responders/${operator.responderId}/availability`, { method: 'PATCH', body: JSON.stringify({ availabilityState }) });
      setResponders((current) => current.map((responder) => responder.responderId === next.responderId ? next : responder));
    } catch { setError('Responder availability could not be updated.'); }
  };

  return (
    <div className="console-shell">
      <header className="console-header">
        <div className="brand-lockup"><span className="brand-mark">N</span><div><strong>NETRI</strong><span>Emergency response console</span></div></div>
        <div className="header-right"><span className={`live-indicator ${connected ? 'online' : ''}`}><i />{connected ? 'LIVE LINK' : 'CONNECTING'}</span><span className="operator-chip">{operator?.name ?? 'Operator'}</span></div>
      </header>
      <main className="console-main">
        <div className="console-heading"><div><p className="eyebrow">RESPONSE OPERATIONS / {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p><h1>Emergency queue</h1><p>Monitor incoming device events and coordinate an organization response.</p></div><div className="operator-control"><span>My availability</span><select value={operator?.availabilityState ?? 'OFFLINE'} onChange={(event) => updateAvailability(event.target.value as Responder['availabilityState'])}><option>AVAILABLE</option><option>BUSY</option><option>OFFLINE</option></select></div></div>
        {error && <div className="notice error">{error}</div>}
        <div className="metric-row"><Metric label="Needs action" value={String(activeIncidents.length)} tone={activeIncidents.length ? 'urgent' : 'normal'} /><Metric label="Escalated" value={String(activeIncidents.filter((incident) => incident.escalationState === 'ESCALATED').length)} tone="urgent" /><Metric label="Responders available" value={String(responders.filter((responder) => responder.availabilityState === 'AVAILABLE').length)} tone="normal" /><Metric label="Transport" value="SIMULATED BLE" tone="muted" /></div>
        <div className="console-grid">
          <section className="queue-panel"><div className="section-heading"><div><span className="eyebrow">INCOMING EVENTS</span><h2>Incident queue</h2></div><span className="count-pill">{activeIncidents.length} active</span></div>{loading ? <div className="empty-state">Loading incident queue…</div> : incidents.length === 0 ? <div className="empty-state"><span className="empty-icon">✓</span><strong>All clear</strong><span>No incidents have been received.</span></div> : <div className="incident-list">{incidents.map((incident) => <IncidentRow key={incident.incidentId} incident={incident} selected={incident.incidentId === selectedId} onClick={() => setSelectedId(incident.incidentId)} />)}</div>}</section>
          <section className="detail-panel">{selectedIncident ? <IncidentDetail incident={selectedIncident} timeline={timeline} operator={operator} working={working} onAcknowledge={() => performAction('acknowledge')} onResolve={() => performAction('resolve')} /> : <div className="empty-state detail-empty"><span className="empty-icon">↗</span><strong>Select an incident</strong><span>Incident details and response actions will appear here.</span></div>}</section>
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'urgent' | 'normal' | 'muted' }): JSX.Element { return <div className={`metric ${tone}`}><span>{label}</span><strong>{value}</strong></div>; }

function IncidentRow({ incident, selected, onClick }: { incident: Incident; selected: boolean; onClick: () => void }): JSX.Element {
  return <button className={`incident-row ${selected ? 'selected' : ''}`} onClick={onClick}><span className={`severity-dot ${incident.severity.toLowerCase()}`} /><span className="incident-row-copy"><strong>{incident.incidentId}</strong><span>{incident.locationZone} · {incident.deviceId}</span></span><span className="incident-row-meta"><Status status={incident.status} /><time>{relativeTime(incident.createdAt)}</time></span></button>;
}

function IncidentDetail({ incident, timeline, operator, working, onAcknowledge, onResolve }: { incident: Incident; timeline: IncidentTimelineEntry[]; operator: Responder | null; working: boolean; onAcknowledge: () => void; onResolve: () => void }): JSX.Element {
  const closed = ['RESOLVED', 'CANCELLED'].includes(incident.status);
  return <div className="detail-content"><div className="detail-top"><div><span className="eyebrow">INCIDENT DETAIL</span><h2>{incident.incidentId}</h2></div><Status status={incident.status} /></div><div className="alert-banner"><span className="alert-symbol">!</span><div><strong>{incident.severity} priority emergency</strong><span>Received {formatDate(incident.createdAt)} from the NETRI device.</span></div></div><div className="detail-facts"><Fact label="Location" value={incident.locationZone} /><Fact label="Device" value={incident.deviceId} mono /><Fact label="Employee" value={incident.employeeId} mono /><Fact label="Assigned to" value={incident.assignedResponderId ?? 'Awaiting responder'} /></div><div className="timeline"><div className="section-heading"><div><span className="eyebrow">AUDIT TRAIL</span><h3>Incident timeline</h3></div><span className={`escalation ${incident.escalationState.toLowerCase()}`}>{incident.escalationState}</span></div>{timeline.map((entry) => <div className="timeline-item" key={entry.timelineId}><span className="timeline-marker" /><div><strong>{entry.type.replaceAll('_', ' ')}</strong><p>{entry.message}</p><time>{formatDate(entry.createdAt)}</time></div></div>)}</div>{!closed && <div className="action-bar">{incident.status === 'ACKNOWLEDGED' ? <button className="action-button resolve" onClick={onResolve} disabled={working}>Resolve incident</button> : <button className="action-button acknowledge" onClick={onAcknowledge} disabled={working || !operator}>Acknowledge & take ownership</button>}<span>Actions are recorded against the shared incident timeline.</span></div>}</div>;
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }): JSX.Element { return <div className="fact"><span>{label}</span><strong className={mono ? 'mono' : ''}>{value}</strong></div>; }
function Status({ status }: { status: Incident['status'] }): JSX.Element { return <span className={`status status-${status.toLowerCase()}`}><i />{status}</span>; }
function relativeTime(value: string): string { const seconds = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 1000)); if (seconds < 60) return `${seconds}s ago`; const minutes = Math.round(seconds / 60); return `${minutes}m ago`; }
function formatDate(value: string): string { return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
