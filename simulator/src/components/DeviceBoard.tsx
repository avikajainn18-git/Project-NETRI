// NETRI — the device, rendered as a cutaway hardware visualization.
//
// One SVG scene, one coordinate space: enclosure shell → PCB → copper traces
// → approved BOM components → frosted cover overlay (with LED windows, the
// SOS dimple and the RESET pinhole aligned over the parts they belong to).
// The tactile button is the interactive element (pointer capture + keyboard);
// the cover layer is pointer-transparent so it never blocks the trigger.
//
// LED behavior and all timing come from the controller snapshot — no logic
// lives here; this is presentation only. Premium industrial rendering: a
// graphite enclosure with defined charcoal edges, a deep recessed tray, and
// the dark green PCB + BOM components reading as real physical hardware.
import type { JSX } from "react";
import { Esp32Board } from "./electronics/Esp32Board";
import { LedDome } from "./electronics/LedDome";
import { Resistor } from "./electronics/Resistor";
import { TactileButton } from "./electronics/TactileButton";
import { DeviceVisualState, type DeviceSnapshot } from "../device/deviceController";

interface DeviceBoardProps {
  snapshot: DeviceSnapshot;
  onPress: () => void;
  onRelease: () => void;
  onRestart: () => void;
  /** Display scale: viewBox stays 340×250, rendered size scales up. */
  scale?: number;
}

// Scene geometry (single coordinate space, 340 × 250):
const W = 340;
const H = 250;
// Enclosure shell (cutaway: top cover transparent, tray visible).
const SHELL = { x: 10, y: 12, w: 320, h: 226, r: 26 };
// PCB inside the tray.
const PCB = { x: 34, y: 40, w: 272, h: 170, r: 10 };
// Component anchors (PCB space).
const ESP = { x: 52, y: 58 }; // Esp32Board top-left (board is 118×52)
const BTN = { cx: ESP.x + 59, cy: ESP.y + 100 }; // tactile trigger below the board
const LED_G = { cx: 250, cy: 96 };
const LED_R = { cx: 276, cy: 96 };
const RES_G = { cx: 233, cy: 136 };
const RES_R = { cx: 271, cy: 136 };

// Cover furniture (aligned over the parts they belong to):
const COVER_WINDOW = { x: 228, y: 82, w: 62, h: 28 }; // LED window over both LEDs
const COVER_SOS = { cx: BTN.cx, cy: BTN.cy - 14 }; // SOS dimple over the trigger
const COVER_RESET = { cx: 305, cy: 196 }; // pinhole at the bottom-right corner

export function DeviceBoard({
  snapshot,
  onPress,
  onRelease,
  onRestart,
  scale = 1,
}: DeviceBoardProps): JSX.Element {
  const emergency = snapshot.visual === DeviceVisualState.EMERGENCY;
  const holding = snapshot.visual === DeviceVisualState.HOLDING;
  const pressed = snapshot.trigger.held;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W * scale}
      height={H * scale}
      role="img"
      aria-label="NETRI device cutaway — approved Round-1 electronics inside the enclosure"
      style={{ display: "block", touchAction: "none", userSelect: "none" }}
    >
      <defs>
        <linearGradient id="shellGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f444b" />
          <stop offset="0.5" stopColor="#33383f" />
          <stop offset="1" stopColor="#22262b" />
        </linearGradient>
        <linearGradient id="trayGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#262a30" />
          <stop offset="0.12" stopColor="#3a3f46" />
          <stop offset="1" stopColor="#141619" />
        </linearGradient>
        <linearGradient id="shieldGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8f979f" />
          <stop offset="0.5" stopColor="#565d66" />
          <stop offset="1" stopColor="#3a4046" />
        </linearGradient>
        <linearGradient id="coverGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.22} />
          <stop offset="1" stopColor="#aeb4bc" stopOpacity={0.1} />
        </linearGradient>
        <filter id="softGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id="capLift" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="1.4" stdDeviation="1.1" floodColor="#101215" floodOpacity="0.5" />
        </filter>
        <filter id="coverSheen" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="7" floodColor="#0f1114" floodOpacity="0.4" />
        </filter>
        <filter id="deviceShadow" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="16" stdDeviation="13" floodColor="#3a352c" floodOpacity="0.42" />
        </filter>
        <filter id="wallShade" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0c0e11" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* ── enclosure shell (cutaway: walls + tray) ─────────────────────────── */}
      <rect
        x={SHELL.x}
        y={SHELL.y}
        width={SHELL.w}
        height={SHELL.h}
        rx={SHELL.r}
        fill="url(#shellGrad)"
        stroke="#15181c"
        strokeWidth={1.6}
        filter="url(#deviceShadow)"
      />
      {/* molded top highlight (crisp, not glassy) */}
      <rect
        x={SHELL.x + 2}
        y={SHELL.y + 1.5}
        width={SHELL.w - 4}
        height={12}
        rx={12}
        fill="#ffffff26"
      />
      {/* bottom shade on the shell rim */}
      <rect
        x={SHELL.x + 3}
        y={SHELL.y + SHELL.h - 10}
        width={SHELL.w - 6}
        height={7}
        rx={4}
        fill="#00000030"
      />
      <rect
        x={SHELL.x + 12}
        y={SHELL.y + 14}
        width={SHELL.w - 24}
        height={SHELL.h - 28}
        rx={18}
        fill="url(#trayGrad)"
        stroke="#0b0d10"
        strokeWidth={1.4}
        filter="url(#wallShade)"
      />
      <text
        x={SHELL.x + 20}
        y={SHELL.y + SHELL.h - 8}
        fontSize={6.5}
        fill="#c9ced6"
        letterSpacing={2}
        fontFamily="ui-monospace, monospace"
        opacity={0.8}
      >
        {snapshot.deviceId}
      </text>

      {/* ── PCB ──────────────────────────────────────────────────────────────── */}
      <rect
        x={PCB.x}
        y={PCB.y}
        width={PCB.w}
        height={PCB.h}
        rx={PCB.r}
        fill="#123f24"
        stroke="#081f10"
        strokeWidth={1.5}
      />
      <rect x={PCB.x} y={PCB.y} width={PCB.w} height={PCB.h * 0.4} rx={PCB.r} fill="#ffffff10" />

      {/* ── copper traces (decorative-but-honest routing, no claims) ─────────── */}
      <g stroke="#2e7d46" strokeWidth={1.6} fill="none" opacity={0.85}>
        {/* trigger button → left edge of the ESP32 header (GPIO 25) */}
        <polyline
          points={`${BTN.cx - 11},${BTN.cy} 96,${BTN.cy} 96,${ESP.y + 46} 52,${ESP.y + 46}`}
        />
        {/* green LED → resistor → ESP32 header (GPIO 26) */}
        <polyline points={`${LED_G.cx},${LED_G.cy + 9} ${RES_G.cx},${RES_G.cy - 6}`} />
        <polyline
          points={`${RES_G.cx + 18},${RES_G.cy} 296,${RES_G.cy} 296,${ESP.y + 38} 170,${ESP.y + 38}`}
        />
        {/* red LED → resistor → ESP32 header (GPIO 27) */}
        <polyline points={`${LED_R.cx},${LED_R.cy + 9} ${RES_R.cx},${RES_R.cy - 6}`} />
        <polyline
          points={`${RES_R.cx + 18},${RES_R.cy} 304,${RES_R.cy} 304,${ESP.y + 46} 178,${ESP.y + 46}`}
        />
        {/* ground rail along the bottom of the PCB */}
        <line
          x1={PCB.x + 16}
          y1={PCB.y + PCB.h - 12}
          x2={PCB.x + PCB.w - 16}
          y2={PCB.y + PCB.h - 12}
          stroke="#276b3d"
          strokeWidth={2.4}
        />
        {/* part legs down to the rail */}
        <polyline points={`${RES_G.cx},${RES_G.cy + 6} ${RES_G.cx},${PCB.y + PCB.h - 12}`} />
        <polyline points={`${RES_R.cx},${RES_R.cy + 6} ${RES_R.cx},${PCB.y + PCB.h - 12}`} />
      </g>

      {/* ── approved BOM components ──────────────────────────────────────────── */}
      <Esp32Board x={ESP.x} y={ESP.y} />
      <Resistor cx={RES_G.cx} cy={RES_G.cy} label="220 Ω resistor (green LED)" />
      <Resistor cx={RES_R.cx} cy={RES_R.cy} label="220 Ω resistor (red LED)" />
      <LedDome cx={LED_G.cx} cy={LED_G.cy} color="green" on={snapshot.greenOn} label="Green status LED" />
      <LedDome cx={LED_R.cx} cy={LED_R.cy} color="red" on={snapshot.redOn} label="Red alert LED" />

      {/* SOS label silkscreened next to the trigger */}
      <text
        x={BTN.cx - 20}
        y={BTN.cy + 3}
        textAnchor="end"
        fontSize={5.5}
        fill="#d7e2da"
        letterSpacing={1.2}
        fontFamily="ui-monospace, monospace"
        opacity={0.75}
      >
        SOS
      </text>

      {/* ── frosted top cover (cutaway: transparent so the electronics show) ─── */}
      <g pointerEvents="none">
        <rect
          x={SHELL.x + 8}
          y={SHELL.y + 10}
          width={SHELL.w - 16}
          height={SHELL.h - 20}
          rx={20}
          fill="url(#coverGrad)"
          stroke="#ffffff2e"
          strokeWidth={1}
          filter="url(#coverSheen)"
        />

        {/* LED window (opens over the LED domes) */}
        <rect
          x={COVER_WINDOW.x}
          y={COVER_WINDOW.y}
          width={COVER_WINDOW.w}
          height={COVER_WINDOW.h}
          rx={8}
          fill="#17191d"
          opacity={0.55}
          stroke="#4a5058"
          strokeWidth={1}
        />

        {/* SOS dimple (opens over the tactile trigger) */}
        <circle
          cx={COVER_SOS.cx}
          cy={COVER_SOS.cy}
          r={17}
          fill="#1d2025"
          opacity={0.6}
          stroke="#5a6169"
          strokeWidth={1}
        />
        <text
          x={COVER_SOS.cx}
          y={COVER_SOS.cy - 21}
          textAnchor="middle"
          fontSize={5}
          fill="#b8bec6"
          letterSpacing={1.4}
          fontFamily="ui-monospace, monospace"
        >
          SOS · HOLD 2s
        </text>

        {/* RESET pinhole (bottom-right of the cover) */}
        <circle
          cx={COVER_RESET.cx}
          cy={COVER_RESET.cy}
          r={4.5}
          fill="#0d0f12"
          opacity={0.95}
          stroke="#565d66"
          strokeWidth={1}
        />
        <text
          x={COVER_RESET.cx}
          y={COVER_RESET.cy + 14}
          textAnchor="middle"
          fontSize={4.6}
          fill="#b8bec6"
          letterSpacing={1}
          fontFamily="ui-monospace, monospace"
        >
          RESET
        </text>
      </g>

      {/* ── interactive layer (kept ABOVE the cover, unobstructed) ──────────── */}
      {/* tactile trigger — the primary control */}
      <TactileButton
        cx={BTN.cx}
        cy={BTN.cy}
        pressed={pressed}
        holdProgress={snapshot.trigger.holdProgress}
        latched={emergency}
        onPress={onPress}
        onRelease={onRelease}
      />
      {/* RESET pinhole — restart button aligned with the cover pinhole */}
      <g
        role="button"
        aria-label="Restart device (power-cycle)"
        tabIndex={0}
        style={{ cursor: "pointer", outline: "none" }}
        onClick={onRestart}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onRestart();
          }
        }}
      >
        <circle cx={COVER_RESET.cx} cy={COVER_RESET.cy} r={9} fill="transparent" />          <circle
            cx={COVER_RESET.cx}
            cy={COVER_RESET.cy}
            r={2.2}
            fill="#31363d"
            stroke="#8a919b"
            strokeWidth={0.8}
          />
      </g>

      {/* holding indicator: progress hairline across the tray bottom */}
      {holding && (
        <g pointerEvents="none">
          <rect
            x={PCB.x}
            y={PCB.y + PCB.h + 8}
            width={PCB.w}
            height={2.5}
            rx={1.2}
            fill="#3a3f46"
          />
          <rect
            x={PCB.x}
            y={PCB.y + PCB.h + 8}
            width={PCB.w * snapshot.trigger.holdProgress}
            height={2.5}
            rx={1.2}
            fill="#f59e0b"
          />
        </g>
      )}
    </svg>
  );
}
