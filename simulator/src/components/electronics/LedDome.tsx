// NETRI — through-hole LED dome (electronic component, not a UI dot).
//
// Rendered as an SVG group so it sits on the PCB among the other BOM parts.
// `on` produces the lit core + halo; off is a dim tinted lens.
import type { JSX } from "react";

export type DomeColor = "green" | "red";

export const LED_LIT = {
  green: "#39d353",
  red: "#ff4d4f",
} as const;

export const LED_DARK = {
  green: "#17301f",
  red: "#38181a",
} as const;

interface LedDomeProps {
  cx: number;
  cy: number;
  color: DomeColor;
  on: boolean;
  label: string;
}

export function LedDome({ cx, cy, color, on, label }: LedDomeProps): JSX.Element {
  const lit = LED_LIT[color];
  const dark = LED_DARK[color];
  const r = 7;
  return (
    <g aria-label={label}>
      {/* halo when lit */}
      {on && <circle cx={cx} cy={cy} r={r + 7} fill={lit} opacity={0.22} filter="url(#softGlow)" />}
      {/* flange base */}
      <rect
        x={cx - r - 2}
        y={cy + r - 2}
        width={(r + 2) * 2}
        height={4}
        rx={1.5}
        fill="#2b3036"
      />
      {/* lens body */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={on ? lit : dark}
        stroke={on ? "#ffffff55" : "#ffffff22"}
        strokeWidth={1}
      />
      {/* specular highlight */}
      <circle cx={cx - 2.2} cy={cy - 2.6} r={2.1} fill={on ? "#ffffffdd" : "#ffffff2e"} />
    </g>
  );
}
