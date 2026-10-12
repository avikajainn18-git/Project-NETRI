import type { ReactNode } from "react";

interface PanelProps {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
  loading?: boolean;
}

export function Panel({
  children,
  className = "",
  title,
  action,
  loading,
}: PanelProps): JSX.Element {
  return (
    <section
      className={`panel rounded-lg border px-16 py-12 ${loading ? "opacity-70 pointer-events-none" : ""} ${className}`}
    >
      {(title || action) && (
        <div className="panel-header">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {loading ? (
        <div className="panel-loading">
          <span className="h-4 w-4 rounded-full border border-current border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="panel-body">{children}</div>
      )}
    </section>
  );
}
