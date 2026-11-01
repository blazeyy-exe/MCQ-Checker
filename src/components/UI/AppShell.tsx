import { NavLink, Outlet } from "react-router-dom";
import { Camera, ClipboardList, History, House, ScanLine } from "lucide-react";

const links = [
  { to: "/", label: "Home", icon: House, end: true },
  { to: "/session/new", label: "Answer key", icon: ClipboardList },
  { to: "/scan", label: "Scan", icon: Camera },
  { to: "/history", label: "History", icon: History },
  { to: "/lab", label: "Lab", icon: ScanLine },
];

export function AppShell() {
  return (
    <div className="min-h-dvh bg-cream text-ink">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pb-24 pt-6 md:pb-10">
        <Outlet />
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-rule/80 bg-paper/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-3 text-[11px] ${isActive ? "text-ink" : "text-ink/45"}`
              }
            >
              <link.icon size={18} />
              {link.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function TopBrand() {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/50">Examination grading</p>
        <h1 className="font-serif text-4xl font-medium tracking-tight text-ink md:text-5xl">MCQ Checker</h1>
      </div>
      <div className="hidden items-center gap-2 md:flex">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `rounded-full px-3 py-1.5 text-sm ${isActive ? "bg-ink text-paper" : "text-ink/60 hover:bg-paper-dark"}`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
