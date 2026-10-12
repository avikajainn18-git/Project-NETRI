import type { ReactNode } from "react";

interface NavItem {
  label: string;
  section: string;
}

interface ShellProps {
  children: ReactNode;
  navItems: NavItem[];
}

export function Shell({ children, navItems }: ShellProps): JSX.Element {
  return (
    <div className="shell">
      <header className="shell-header">
        <div className="flex items-center gap-3">
          <span className="shell-logo">NETRI</span>
          <span className="shell-logo-label">Organization Console</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="shell-staff">emergency.ops@acme.edu</span>
        </div>
      </header>

      <nav className="shell-nav">
        {navItems.map((item) => (
          <a
            key={item.section}
            href={`#${item.section}`}
            className={`shell-nav-link ${item.section === "overview" ? "is-active" : ""}`}
            aria-current={item.section === "overview" ? "page" : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>

      <main className="shell-main">{children}</main>
    </div>
  );
}
