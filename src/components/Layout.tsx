import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/import", label: "Import" },
  { to: "/style", label: "Style Me" },
  { to: "/scan", label: "Scanner" },
  { to: "/match", label: "Match" },
  { to: "/analytics", label: "Analytics" },
  { to: "/lookbook", label: "\uD83D\uDCC5 Lookbook" },
] as const;

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <nav className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          <span className="text-lg font-bold tracking-tight">
            Pocket Stylist
          </span>

          <div className="flex gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-neutral-600 hover:bg-neutral-100"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* User info + logout */}
          {user && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-neutral-100"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name ?? "avatar"}
                    className="h-8 w-8 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                    {(user.name ?? user.email).charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="hidden text-sm font-medium text-neutral-700 sm:inline">
                  {user.name ?? user.email}
                </span>
              </button>
              <button
                type="button"
                onClick={logout}
                className="rounded-md px-2 py-1 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
              >
                Вийти
              </button>
            </div>
          )}
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
