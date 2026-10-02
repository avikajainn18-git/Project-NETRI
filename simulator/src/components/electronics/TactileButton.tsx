// NETRI — tactile momentary push button (BOM item 2, the SOS trigger).
//
// Drawn as the real through-hole part: a square 4-pin base with a round
// actuator cap. This is the physical component the user actually presses —
// the same <button> interaction surface as before (pointer capture, keyboard
// hold), now rendered to look like the hardware.
import { useCallback, type JSX, type PointerEvent as ReactPointerEvent } from "react";

interface TactileButtonProps {
  cx: number; // board position of the component center
  cy: number;
  pressed: boolean;
  holdProgress: number; // 0..1 during an arming hold; 1 when latched
  latched: boolean;
  onPress: () => void;
  onRelease: () => void;
}

export function TactileButton({
  cx,
  cy,
  pressed,
  holdProgress,
  latched,
  onPress,
  onRelease,
}: TactileButtonProps): JSX.Element {
  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<SVGGElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      onPress();
    },
    [onPress],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<SVGGElement>) => {
      e.preventDefault();
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      onRelease();
    },
    [onRelease],
  );

  const capOffset = pressed ? 1.5 : 0; // physical travel when pressed

  return (
    <g
      role="button"
      aria-label="SOS trigger — press and hold for 2 seconds"
      aria-pressed={pressed}
      tabIndex={0}
      style={{ cursor: "pointer", outline: "none" }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          onPress();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onRelease();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <g transform={`translate(${cx} ${cy})`}>
        {/* 4-pin through-hole base */}
        <rect x={-11} y={-11} width={22} height={22} rx={2} fill="#3a3f46" stroke="#191c20" strokeWidth={1.2} />
        {[
          [-7.5, -7.5],
          [7.5, -7.5],
          [-7.5, 7.5],
          [7.5, 7.5],
        ].map(([x, y]) => (
          <circle key={`${x},${y}`} cx={x} cy={y} r={1.6} fill="#565d66" stroke="#101215" strokeWidth={0.5} />
        ))}

        {/* arming progress arc around the actuator */}
        {holdProgress > 0 && (
          <circle
            cx={0}
            cy={0}
            r={10.5}
            fill="none"
            stroke={latched ? "#ff4d4fd9" : "#ffb84dcc"}
            strokeWidth={1.6}
            strokeDasharray={`${holdProgress * 2 * Math.PI * 10.5} ${2 * Math.PI * 10.5}`}
            strokeLinecap="round"
            transform="rotate(-90)"
            opacity={latched ? 1 : 0.85}
          />
        )}

        {/* actuator cap (travels down when pressed) */}
        <g transform={`translate(0 ${capOffset})`}>
          <circle
            cx={0}
            cy={0}
            r={7}
            style={{
              fill: latched ? "#3a2a2d" : "#3d434b",
              transition: "fill 120ms linear",
            }}
            stroke={latched ? "#ff8a8d66" : "#ffffff2a"}
            strokeWidth={1}
            filter={pressed ? undefined : "url(#capLift)"}
          />
          <circle cx={-2} cy={-2.2} r={1.8} fill="#ffffff30" />
        </g>

        {/* pressed shadow under the cap */}
        {pressed && <circle cx={0} cy={1.2} r={7} fill="#10121559" />}
      </g>
    </g>
  );
}
