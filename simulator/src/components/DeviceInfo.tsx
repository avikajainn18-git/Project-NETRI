// NETRI — minimal device information (what a device owner would see).
//
// Three fields only:
//   - Device ID: the organization's identifier for this device (D6).
//   - Battery: UI placeholder — D2 keeps battery/power documentation-only
//     until a future phase simulates it; shown honestly as unavailable.
//   - Phone BLE: UI placeholder — no transport exists until Phase 3; the
//     Connected/Disconnected value is a local simulated display state only
//     and is not wired to any device logic or networking.
import { useState, type JSX } from "react";

interface DeviceInfoProps {
  deviceId: string;
}

export function DeviceInfo({ deviceId }: DeviceInfoProps): JSX.Element {
  const [bleSimulated, setBleSimulated] = useState(false);

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
      <Row
        label="Phone BLE"
        value={
          <button
            type="button"
            onClick={() => setBleSimulated((v) => !v)}
            title="Simulated display state only — no BLE transport exists until Phase 3"
            style={{
              all: "unset",
              cursor: "pointer",
              color: bleSimulated ? "#2f7d4f" : "#8a8f98",
              borderBottom: "1px dashed #c8c0b2",
            }}
          >
            {bleSimulated ? "Connected" : "Disconnected"} · simulated
          </button>
        }
      />
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
