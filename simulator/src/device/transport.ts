import type { DeviceEvent } from './events';

export type GatewayStatus = 'CHECKING' | 'READY' | 'DELIVERED' | 'UNAVAILABLE';
export type GatewayStatusListener = (status: GatewayStatus) => void;

const GATEWAY_URL = (import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:4001').replace(/\/$/, '');

const DEVICE_CONTEXT: Record<string, { employeeId: string; locationZone: string }> = {
  'NETRI-001': { employeeId: 'EMP-1042', locationZone: 'Library' },
  'NETRI-002': { employeeId: 'EMP-1088', locationZone: 'Engineering Lab' },
  'NETRI-003': { employeeId: 'EMP-1116', locationZone: 'Hostel 2' },
};

export class SimulatedBleTransport {
  private readonly listeners = new Set<GatewayStatusListener>();
  private status: GatewayStatus = 'CHECKING';

  constructor() {
    void this.refresh();
  }

  onStatus(listener: GatewayStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  currentStatus(): GatewayStatus {
    return this.status;
  }

  async sendEmergency(event: DeviceEvent): Promise<void> {
    const context = DEVICE_CONTEXT[event.deviceId] ?? { employeeId: 'EMP-1042', locationZone: 'Unassigned zone' };
    try {
      const response = await fetch(`${GATEWAY_URL}/gateway/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventId: makeEventId(),
          kind: 'EMERGENCY_TRIGGERED',
          deviceId: event.deviceId,
          employeeId: context.employeeId,
          locationZone: context.locationZone,
          occurredAt: new Date(event.occurredAtMs).toISOString(),
          source: 'SIMULATOR',
          transport: 'SIMULATED_BLE',
        }),
      });
      if (!response.ok) throw new Error('gateway rejected event');
      this.setStatus('DELIVERED');
    } catch {
      this.setStatus('UNAVAILABLE');
    }
  }

  async refresh(): Promise<void> {
    try {
      const response = await fetch(`${GATEWAY_URL}/health`);
      this.setStatus(response.ok ? 'READY' : 'UNAVAILABLE');
    } catch {
      this.setStatus('UNAVAILABLE');
    }
  }

  private setStatus(status: GatewayStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }
}

function makeEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
