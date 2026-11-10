import { useEffect, useRef, useState, type JSX } from "react";
import { DeviceBoard } from "./components/DeviceBoard";
import { DeviceInfo } from "./components/DeviceInfo";
import {
  DeviceController,
  DeviceVisualState,
  type DeviceSnapshot,
} from "./device/deviceController";
import {
  SimulatedBleTransport,
  type GatewayStatus,
} from "./device/transport";

const STATUS_TEXT = {
  [DeviceVisualState.BOOT_SELF_TEST]: "boot · self-test",
  [DeviceVisualState.IDLE_READY]: "operational",
  [DeviceVisualState.HOLDING]: "arming — keep holding",
  [DeviceVisualState.EMERGENCY]: "emergency — latched (reset to clear)",
} as const;

const STATUS_COLOR = {
  [DeviceVisualState.BOOT_SELF_TEST]: "#8a8f98",
  [DeviceVisualState.IDLE_READY]: "#2f7d4f",
  [DeviceVisualState.HOLDING]: "#b45309",
  [DeviceVisualState.EMERGENCY]: "#c2343b",
} as const;

const PORTAL_HOME_URL = import.meta.env.DEV
  ? "http://localhost:4000/"
  : "/";

export default function App(): JSX.Element {
  const controllerRef = useRef<DeviceController | null>(null);

  if (controllerRef.current === null) {
    controllerRef.current = new DeviceController();
  }

  const controller = controllerRef.current;

  const transportRef = useRef<SimulatedBleTransport | null>(null);

  if (transportRef.current === null) {
    transportRef.current = new SimulatedBleTransport();
  }

  const transport = transportRef.current;

  const [snapshot, setSnapshot] = useState<DeviceSnapshot>(() =>
    controller.snapshot()
  );

  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus>(() =>
    transport.currentStatus()
  );

  useEffect(() => {
    const timer = window.setInterval(() => controller.tick(), 16);

    const offSnapshot = controller.onSnapshot(setSnapshot);
    const offTransport = transport.onStatus(setGatewayStatus);

    const transportHealthTimer = window.setInterval(
      () => void transport.refresh(),
      5000
    );

    const offEvents = controller.onEvent((event) => {
      void transport.sendEmergency(event);
    });

    return () => {
      window.clearInterval(timer);
      offSnapshot();
      offTransport();
      offEvents();
      window.clearInterval(transportHealthTimer);
    };
  }, [controller, transport]);

  const handleRestart = () => controller.restart();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#eeeae2",
        color: "#1f2328",
        font: "13px/1.5 ui-sans-serif, system-ui, sans-serif",
        padding: "28px 16px",
      }}
    >
      <a
        href={PORTAL_HOME_URL}
        aria-label="Back to NETRI home"
        style={{
          position: "fixed",
          top: 20,
          left: 24,
          zIndex: 10,
          padding: "8px 12px",
          border: "1px solid #d4cfc4",
          borderRadius: 6,
          background: "#f7f5f1",
          color: "#3a3f45",
          fontSize: 12,
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        ← Back to Home
      </a>

      {/* One intentional group: wordmark → device → status → info */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: 4,
            color: "#3a3f45",
            fontWeight: 700,
          }}
        >
          NETRI
        </div>

        {/* The hardware: primary visual, scaled 1.5x */}
        <div style={{ margin: "2px 0" }}>
          <DeviceBoard
            snapshot={snapshot}
            scale={1.5}
            onPress={() => controller.pressTrigger()}
            onRelease={() => controller.releaseTrigger()}
            onRestart={handleRestart}
          />
        </div>

        <div
          style={{
            font: "600 12px/1.4 ui-monospace, monospace",
            letterSpacing: 1.2,
            color: STATUS_COLOR[snapshot.visual],
          }}
        >
          {STATUS_TEXT[snapshot.visual].toUpperCase()}
        </div>

        <DeviceInfo
          deviceId={snapshot.deviceId}
          gatewayStatus={gatewayStatus}
        />
      </div>
    </div>
  );
}