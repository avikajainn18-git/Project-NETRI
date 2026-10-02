// NETRI — ESP32 DevKit V1 (BOM item 1), drawn to scale-ish top view.
//
// Recognizable features of the real board: wide PCB, the metal RF shield
// can marked ESP-WROOM-32, the two USB/serial chips area, two rows of pins
// along the long edges, BOOT + EN buttons, and the micro-USB connector at
// the short edge. Purely presentational SVG — no claims beyond the board
// that the approved Wokwi part models.
import type { JSX } from "react";

interface Esp32BoardProps {
  x: number; // top-left placement on the device PCB
  y: number;
  width?: number;
  height?: number;
}

export function Esp32Board({ x, y, width = 118, height = 52 }: Esp32BoardProps): JSX.Element {
  const shieldW = 34;
  const shieldH = 24;
  const pinRows = Array.from({ length: 8 }, (_, i) => i);

  return (
    <g aria-label="ESP32 DevKit V1 microcontroller">
      {/* PCB substrate */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={3}
        fill="#134d29"
        stroke="#0c3019"
        strokeWidth={1.5}
      />
      {/* subtle PCB sheen */}
      <rect x={x} y={y} width={width} height={height * 0.42} rx={3} fill="#ffffff08" />

      {/* RF shield can (ESP-WROOM-32 module) */}
      <rect
        x={x + 42}
        y={y + 5}
        width={shieldW}
        height={shieldH}
        rx={2}
        fill="url(#shieldGradient)"
        stroke="#0e1114"
        strokeWidth={1}
      />
      {/* shield silkscreen texture */}
      {Array.from({ length: 5 }, (_, i) => (
        <line
          key={i}
          x1={x + 45 + i * 7}
          y1={y + 7}
          x2={x + 45 + i * 7}
          y2={y + 5 + shieldH - 2}
          stroke="#ffffff10"
          strokeWidth={2.5}
        />
      ))}
      <text
        x={x + 42 + shieldW / 2}
        y={y + 5 + shieldH + 7}
        textAnchor="middle"
        fontSize={4.6}
        fill="#d7e2da"
        letterSpacing={0.4}
        fontFamily="ui-monospace, monospace"
      >
        ESP-WROOM-32
      </text>

      {/* micro-USB connector (short edge, left) */}
      <rect x={x - 4} y={y + 18} width={10} height={14} rx={2} fill="#b7bec6" stroke="#5f666e" strokeWidth={0.8} />
      <rect x={x - 2} y={y + 21} width={6} height={8} rx={1} fill="#23262b" />

      {/* BOOT / EN buttons (right short edge) */}
      <rect x={x + width - 10} y={y + 8} width={7} height={7} rx={1} fill="#3d434b" stroke="#1a1d21" strokeWidth={0.7} />
      <rect x={x + width - 10} y={y + 34} width={7} height={7} rx={1} fill="#3d434b" stroke="#1a1d21" strokeWidth={0.7} />

      {/* pin rows along the long edges */}
      {pinRows.map((i) => (
        <g key={`top${i}`}>
          <rect
            x={x + 12 + i * 12}
            y={y - 4}
            width={5}
            height={4.5}
            fill="#1f2226"
          />
          <rect
            x={x + 13 + i * 12}
            y={y - 3.2}
            width={3}
            height={3.4}
            fill="#d8dde2"
          />
        </g>
      ))}
      {pinRows.map((i) => (
        <g key={`bot${i}`}>
          <rect
            x={x + 12 + i * 12}
            y={y + height - 0.5}
            width={5}
            height={4.5}
            fill="#1f2226"
          />
          <rect
            x={x + 13 + i * 12}
            y={y + height + 0.3}
            width={3}
            height={3.4}
            fill="#d8dde2"
          />
        </g>
      ))}

      {/* silkscreen: board name */}
      <text
        x={x + 8}
        y={y + height - 7}
        fontSize={4.4}
        fill="#d7e2da"
        letterSpacing={0.4}
        fontFamily="ui-monospace, monospace"
      >
        ESP32 DevKit V1
      </text>
    </g>
  );
}
