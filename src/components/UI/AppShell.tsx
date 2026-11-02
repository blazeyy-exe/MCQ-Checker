import { NavLink, Outlet } from "react-router-dom";
import { Camera, ClipboardList, History, House, ScanLine } from "lucide-react";
import { TickdMark } from "./TickdMark";

const links = [
  { to: "/", label: "Home", icon: House, end: true },
  { to: "/session/new", label: "Answer key", icon: ClipboardList },
  { to: "/scan", label: "Scan", icon: Camera },
  { to: "/history", label: "History", icon: History },
  { to: "/lab", label: "Lab", icon: ScanLine },
];

export function AppShell() {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pb-24 pt-6 md:pb-10">
        <Outlet />
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-white md:hidden">
        <div className="grid grid-cols-5">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-[11px] ${isActive ? "text-indigo" : "text-ink-soft"}`
              }
            >
              <link.icon size={20} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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
    <div className="mb-8 flex items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-3">
          <TickdMark className="h-11 w-11 shrink-0" />
          <div>
            <p className="text-2xl font-extrabold leading-tight tracking-[-0.03em] text-navy">Tickd</p>
            <p className="text-xs font-semibold text-slate">MCQ Checker</p>
          </div>
        </div>
      </div>
      <div className="hidden items-center gap-2 md:flex">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `min-h-11 rounded-full px-4 py-2 text-sm font-bold ${isActive ? "bg-indigo text-white" : "text-slate hover:bg-white"}`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
