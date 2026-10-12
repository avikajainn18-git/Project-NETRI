import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "status" | "severity" | "availability" | "alarm" | "ghost";
  className?: string;
}

export function StatusBadge({ children, variant = "status", className = "" }: BadgeProps): JSX.Element {
  let badgeClass = "badge";
  let isEmergency = false;

  if (variant === "alarm") {
    badgeClass += " badge-alarm";
    isEmergency = true;
  } else if (variant === "severity") {
    switch (String(children).toUpperCase()) {
      case "CRITICAL":
        badgeClass += " badge-alarm";
        isEmergency = true;
        break;
      case "HIGH":
        badgeClass += " badge-border badge-bg";
        break;
      default:
        badgeClass += " badge-accent";
        break;
    }
  } else if (variant === "availability") {
    switch (String(children).toUpperCase()) {
      case "OFFLINE":
        badgeClass += " badge-alarm";
        isEmergency = true;
        break;
      case "BUSY":
        badgeClass += " badge-border badge-bg";
        break;
      default:
        badgeClass += " badge-accent";
        break;
    }
  } else if (variant === "status") {
    switch (String(children).toUpperCase()) {
      case "ACTIVE":
      case "ASSIGNED":
      case "ACKNOWLEDGED":
      case "RESOLVED":
      case "CANCELLED":
        badgeClass += " badge-accent";
        break;
      default:
        badgeClass += " badge-border";
        break;
    }
  }

  return (
    <span className={`${badgeClass} ${className}`}>
      {children}
      {isEmergency && (
        <span className="badge-tag">emergency</span>
      )}
    </span>
  );
}
