// NETRI — minimal device information (what a device owner would see).
//
// Three fields only:
//   - Device ID: the organization's identifier for this device (D6).
//   - Battery: UI placeholder — D2 keeps battery/power documentation-only
//     until a future phase simulates it; shown honestly as unavailable.
//   - Phone gateway: the actual Round-1 simulated-BLE relay status. It reports
//     gateway availability and delivery failures without claiming real BLE.
import type { JSX } from "react";
import type { GatewayStatus } from "../device/transport";

interface DeviceInfoProps {
  deviceId: string;
  gatewayStatus: GatewayStatus;
}

export function DeviceInfo({ deviceId, gatewayStatus }: DeviceInfoProps): JSX.Element {
  const gatewayLabel: Record<GatewayStatus, string> = {
    CHECKING: "Checking gateway",
    READY: "Ready · simulated",
    DELIVERED: "Event delivered · simulated",
    UNAVAILABLE: "Unavailable · simulated",
  };

  return (
    <div
      aria-label="device information"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "10px 14px",
        borderRadius: 10,
        background: "#fdfcfa",
        border: "1px solid #ddd6c9",
        boxShadow: "0 2px 8px rgba(58, 53, 44, 0.14)",
        minWidth: 264,
      }}
    >
      <Row label="Device ID" value={deviceId} />
      <Row label="Battery" value="Unavailable · not simulated" muted />
      <Row label="Phone gateway" value={gatewayLabel[gatewayStatus]} muted={gatewayStatus === "UNAVAILABLE"} />
    </div>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string | JSX.Element;
  muted?: boolean;
}): JSX.Element {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
      <span style={{ fontSize: 11.5, color: "#6b6f76" }}>{label}</span>
      <span
        style={{
          font: "11.5px/1.4 ui-monospace, monospace",
          color: muted ? "#8a8f98" : "#1f2328",
          fontWeight: 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}
