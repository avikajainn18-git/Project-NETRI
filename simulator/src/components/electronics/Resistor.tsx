// NETRI — axial 220 Ω resistor (BOM item 5).
//
// Body with the actual color code for 220 Ω: red–red–brown–gold
// (2, 2, ×10, ±5%). Drawn horizontally, centered on (cx, cy).
import type { JSX } from "react";

interface ResistorProps {
  cx: number;
  cy: number;
  label: string;
}

const BANDS: Array<[number, string]> = [
  [-8, "#c0392b"], // red   (2)
  [-3.5, "#c0392b"], // red   (2)
  [1, "#8b4a2b"], // brown (×10)
  [5.5, "#c9a227"], // gold  (±5%)
];

export function Resistor({ cx, cy, label }: ResistorProps): JSX.Element {
  return (
    <g aria-label={label}>
      {/* leads */}
      <line x1={cx - 18} y1={cy} x2={cx - 10} y2={cy} stroke="#b8bfc6" strokeWidth={1.6} />
      <line x1={cx + 10} y1={cy} x2={cx + 18} y2={cy} stroke="#b8bfc6" strokeWidth={1.6} />
      {/* body */}
      <rect x={cx - 10} y={cy - 5} width={20} height={10} rx={4.5} fill="#d9c39a" />
      <rect x={cx - 10} y={cy - 5} width={20} height={4} rx={2} fill="#00000018" />
      {BANDS.map(([dx, color]) => (
        <rect key={dx} x={cx + dx} y={cy - 5} width={2.4} height={10} fill={color} />
      ))}
    </g>
  );
}
