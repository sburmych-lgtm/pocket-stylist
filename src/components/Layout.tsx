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
  Calendar,
  Users,
  LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  mobileNav?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Головна", icon: Home, mobileNav: true },
  { to: "/wardrobe", label: "Гардероб", icon: Shirt, mobileNav: true },
  { to: "/import", label: "Імпорт", icon: Camera, mobileNav: true },
  { to: "/style", label: "Стиль", icon: Sparkles, mobileNav: true },
  { to: "/scan", label: "Сканер", icon: ScanLine, mobileNav: true },
  { to: "/match", label: "Матч", icon: Star },
  { to: "/analytics", label: "Аналітика", icon: BarChart3 },
  { to: "/lookbook", label: "Лукбук", icon: Calendar },
  { to: "/family", label: "Сім'я", icon: Users },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-[#f0ece4]">
      {/* ===== Desktop Top Nav ===== */}
      <nav className="fixed top-0 z-50 hidden w-full border-b border-white/[0.06] bg-[#0f0f1a]/80 backdrop-blur-xl md:block">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-3">
          {/* Logo */}
          <button
            type="button"
            onClick={() => navigate("/")}
            className="font-display mr-8 text-xl font-semibold tracking-wide text-[#c9a55a]"
          >
            Pocket Stylist
          </button>

          {/* Nav Links */}
          <div className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium tracking-wide transition-all duration-300 ${
                    isActive
                      ? "text-[#c9a55a]"
                      : "text-[#f0ece4]/50 hover:text-[#f0ece4]/80"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="uppercase text-[11px] tracking-[0.08em]">{item.label}</span>
                    {isActive && (
                      <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-[#c9a55a]" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* User */}
          {user && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-white/[0.05]"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name ?? "avatar"}
                    className="h-8 w-8 rounded-full border-2 border-[#c9a55a]/40 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#c9a55a]/40 bg-[#c9a55a]/10 text-sm font-semibold text-[#c9a55a]">
                    {(user.name ?? user.email).charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium text-[#f0ece4]/70">
                  {user.name ?? user.email}
                </span>
              </button>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg p-2 text-[#f0ece4]/30 transition-colors hover:bg-white/[0.05] hover:text-[#f0ece4]/60"
                title="Вийти"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ===== Mobile Top Bar ===== */}
      <div className="fixed top-0 z-50 flex w-full items-center justify-between border-b border-white/[0.06] bg-[#0f0f1a]/80 px-4 py-3 backdrop-blur-xl md:hidden">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="font-display text-lg font-semibold text-[#c9a55a]"
        >
          Pocket Stylist
        </button>
        {user && (
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#c9a55a]/40 bg-[#c9a55a]/10 text-xs font-semibold text-[#c9a55a]"
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
        )}
      </div>

      {/* ===== Page Content ===== */}
      <main className="pt-14 pb-20 md:pt-16 md:pb-8">
        <Outlet />
      </main>

      {/* ===== Mobile Bottom Tab Bar ===== */}
      <nav className="fixed bottom-0 z-50 w-full border-t border-white/[0.06] bg-[#0f0f1a]/90 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-around px-2 py-1">
          {NAV_ITEMS.filter((i) => i.mobileNav).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 transition-all duration-300 ${
                  isActive
                    ? "text-[#c9a55a]"
                    : "text-[#f0ece4]/35 active:text-[#f0ece4]/60"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
                  <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
