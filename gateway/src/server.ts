import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { EmergencyEventSchema } from '@netri/contracts';

const port = Number(process.env.PORT ?? 4001);
const backendUrl = (process.env.NETRI_BACKEND_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const app = express();

app.use(cors());
app.use(express.json({ limit: '32kb' }));

function error(response: Response, status: number, message: string): void {
  response.status(status).json({ error: message });
}

app.get('/health', (_request, response) => {
  response.json({ service: 'netri-gateway', status: 'ok', transport: 'simulated-ble', backendUrl });
});

app.post('/gateway/events', async (request: Request, response: Response) => {
  const parsed = EmergencyEventSchema.safeParse(request.body);
  if (!parsed.success) return error(response, 400, 'Invalid device event.');
  try {
    const backendResponse = await fetch(`${backendUrl}/api/events/emergency`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-netri-gateway': 'simulated-ble' },
      body: JSON.stringify(parsed.data),
    });
    const body = await backendResponse.json() as unknown;
    if (!backendResponse.ok) return error(response, backendResponse.status, 'Backend rejected the emergency event.');
    return response.status(backendResponse.status).json({ ...body as object, relayedBy: 'simulated-ble-gateway' });
  } catch {
    return error(response, 503, 'Backend is unavailable; the gateway could not relay this event.');
  }
});

app.listen(port, () => {
  console.log(`NETRI simulated BLE gateway listening on http://localhost:${port}`);
  console.log(`Relaying device events to ${backendUrl}`);
});
