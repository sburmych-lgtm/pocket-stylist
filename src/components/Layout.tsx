import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  Home,
  Shirt,
  Camera,
  Sparkles,
  ScanLine,
  Star,
  BarChart3,
  CalendarDays,
  Users,
  LogOut,
  ArrowUpRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  mobileNav?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: Home, mobileNav: true },
  { to: "/wardrobe", label: "Wardrobe", icon: Shirt, mobileNav: true },
  { to: "/import", label: "Import", icon: Camera, mobileNav: true },
  { to: "/style", label: "Style", icon: Sparkles, mobileNav: true },
  { to: "/scan", label: "Scanner", icon: ScanLine, mobileNav: true },
  { to: "/match", label: "Match", icon: Star, mobileNav: true },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/lookbook", label: "Lookbook", icon: CalendarDays },
  { to: "/family", label: "Family", icon: Users },
];

function BrandBlock() {
  return (
    <div className="flex items-center gap-3">
      <div className="spotlight-ring flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(214,177,111,0.08)] text-[var(--accent)]">
        <Sparkles size={18} strokeWidth={2.2} />
      </div>
      <div>
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.28em] text-[var(--text-muted)]">
          Digital Atelier
        </p>
        <p className="font-display text-[1.7rem] leading-none text-[var(--text-primary)]">
          Pocket Stylist
        </p>
      </div>
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen text-[var(--text-primary)]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[6%] top-[12%] h-56 w-56 rounded-full bg-[rgba(214,177,111,0.12)] blur-[110px]" />
        <div className="absolute right-[4%] top-[18%] h-72 w-72 rounded-full bg-[rgba(136,198,189,0.09)] blur-[130px]" />
        <div className="absolute bottom-[6%] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[rgba(122,94,184,0.09)] blur-[140px]" />
      </div>

      <nav className="fixed inset-x-0 top-4 z-50 hidden px-4 md:block">
        <div className="mx-auto flex max-w-7xl items-center gap-4 rounded-[2rem] border border-white/10 bg-[var(--bg-overlay)] px-5 py-4 shadow-[0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
          <button type="button" onClick={() => navigate("/")} className="shrink-0 text-left">
            <BrandBlock />
          </button>

          <div className="editorial-divider w-16 shrink-0" />

          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1 pt-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  [
                    "group flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.2em] transition-all duration-200",
                    isActive
                      ? "bg-[rgba(214,177,111,0.16)] text-[var(--accent)] shadow-[inset_0_0_0_1px_rgba(214,177,111,0.18)]"
                      : "text-[var(--text-muted)] hover:bg-white/[0.05] hover:text-[var(--text-primary)]",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={15} strokeWidth={isActive ? 2.4 : 1.8} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {user && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="floating-panel flex items-center gap-3 px-2.5 py-2 transition-colors hover:bg-white/[0.08]"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name ?? "avatar"}
                    className="h-10 w-10 rounded-full object-cover ring-1 ring-[rgba(214,177,111,0.28)]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(214,177,111,0.12)] text-sm font-bold text-[var(--accent)] ring-1 ring-[rgba(214,177,111,0.28)]">
                    {(user.name ?? user.email).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {user.name ?? user.email}
                  </p>
                  <p className="flex items-center gap-1 text-[0.68rem] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Personal Atelier
                    <ArrowUpRight size={11} />
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={logout}
                className="icon-action h-11 w-11"
                title="Вийти"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="fixed inset-x-0 top-3 z-50 px-3 md:hidden">
        <div className="mx-auto flex max-w-xl items-center justify-between rounded-[1.6rem] border border-white/10 bg-[var(--bg-overlay)] px-4 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
          <button type="button" onClick={() => navigate("/")} className="text-left">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.24em] text-[var(--text-muted)]">
              Digital Atelier
            </p>
            <p className="font-display text-[1.55rem] leading-none text-[var(--text-primary)]">
              Pocket Stylist
            </p>
          </button>

          {user && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="spotlight-ring flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(214,177,111,0.12)] text-sm font-bold text-[var(--accent)]"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-full w-full rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  (user.name ?? user.email).charAt(0).toUpperCase()
                )}
              </button>
              <button
                type="button"
                onClick={logout}
                className="icon-action h-10 w-10"
                title="Вийти"
              >
                <LogOut size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      <main className="pb-28 pt-24 md:pb-12 md:pt-28">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-4 z-50 px-3 md:hidden">
        <div className="mx-auto flex max-w-xl items-center justify-between rounded-[1.75rem] border border-white/10 bg-[var(--bg-overlay)] px-2 py-2 shadow-[0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
          {NAV_ITEMS.filter((item) => item.mobileNav).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                [
                  "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[1.2rem] px-2 py-2.5 text-[0.58rem] font-semibold uppercase tracking-[0.16em] transition-all duration-200",
                  isActive
                    ? "bg-[rgba(214,177,111,0.16)] text-[var(--accent)]"
                    : "text-[var(--text-muted)]",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} strokeWidth={isActive ? 2.4 : 1.8} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
