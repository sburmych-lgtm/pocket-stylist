import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useI18n } from "../i18n";
import type { Language } from "../i18n";
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
  Globe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  mobileNav?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", labelKey: "nav.home", icon: Home, mobileNav: true },
  { to: "/wardrobe", labelKey: "nav.wardrobe", icon: Shirt, mobileNav: true },
  { to: "/import", labelKey: "nav.import", icon: Camera, mobileNav: true },
  { to: "/style", labelKey: "nav.style", icon: Sparkles, mobileNav: true },
  { to: "/scan", labelKey: "nav.scanner", icon: ScanLine, mobileNav: true },
  { to: "/match", labelKey: "nav.match", icon: Star, mobileNav: true },
  { to: "/analytics", labelKey: "nav.analytics", icon: BarChart3 },
  { to: "/lookbook", labelKey: "nav.lookbook", icon: CalendarDays },
  { to: "/family", labelKey: "nav.family", icon: Users },
];

function LangSwitch({ lang, setLang }: { lang: Language; setLang: (l: Language) => void }) {
  return (
    <div className="flex items-center rounded-full border border-white/8 bg-white/[0.03] text-[0.65rem] font-bold uppercase">
      <button
        type="button"
        onClick={() => setLang("uk")}
        className={`rounded-full px-2.5 py-1.5 transition-colors ${lang === "uk" ? "bg-[var(--accent)] text-[#0a0c12]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
      >
        UA
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`rounded-full px-2.5 py-1.5 transition-colors ${lang === "en" ? "bg-[var(--accent)] text-[#0a0c12]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
      >
        EN
      </button>
    </div>
  );
}

function BrandBlock() {
  return (
    <div className="flex items-center gap-3">
      <div className="spotlight-ring flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(201,165,90,0.08)] text-[var(--accent)]">
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
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen text-[var(--text-primary)]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[6%] top-[12%] h-56 w-56 rounded-full bg-[rgba(201,165,90,0.12)] blur-[110px]" />
        <div className="absolute right-[4%] top-[18%] h-72 w-72 rounded-full bg-[rgba(136,198,189,0.09)] blur-[130px]" />
        <div className="absolute bottom-[6%] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[rgba(122,94,184,0.09)] blur-[140px]" />
      </div>

      {/* Desktop nav */}
      <nav className="fixed inset-x-0 top-4 z-50 hidden px-4 md:block">
        <div className="mx-auto flex max-w-7xl items-center gap-4 rounded-[2rem] border border-white/10 bg-[var(--bg-overlay)] px-5 py-4 shadow-[0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
          <button type="button" onClick={() => navigate("/")} className="shrink-0 text-left">
            <BrandBlock />
          </button>

          <div className="editorial-divider shrink-0" style={{ width: "4rem" }} />

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
                      ? "bg-[rgba(201,165,90,0.16)] text-[var(--accent)] shadow-[inset_0_0_0_1px_rgba(201,165,90,0.18)]"
                      : "text-[var(--text-muted)] hover:bg-white/[0.05] hover:text-[var(--text-primary)]",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={15} strokeWidth={isActive ? 2.4 : 1.8} />
                    <span>{t(item.labelKey)}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {user && (
            <div className="flex shrink-0 items-center gap-2">
              <LangSwitch lang={lang} setLang={setLang} />

              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="floating-panel flex items-center gap-3 px-2.5 py-2 transition-colors hover:bg-white/[0.08]"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name ?? "avatar"}
                    className="h-10 w-10 rounded-full object-cover ring-1 ring-[rgba(201,165,90,0.28)]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(201,165,90,0.12)] text-sm font-bold text-[var(--accent)] ring-1 ring-[rgba(201,165,90,0.28)]">
                    {(user.name ?? user.email).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {user.name ?? user.email}
                  </p>
                  <p className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {t("brand.personalAtelier")}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)] transition-colors hover:bg-[rgba(239,138,128,0.12)] hover:text-[var(--danger)]"
                title={t("common.logout")}
              >
                <LogOut size={14} strokeWidth={2} />
                {t("common.logout")}
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile top bar */}
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

          <div className="flex items-center gap-2">
            <LangSwitch lang={lang} setLang={setLang} />

            {user && (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/profile")}
                  className="spotlight-ring flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(201,165,90,0.12)] text-sm font-bold text-[var(--accent)]"
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
                  title={t("common.logout")}
                >
                  <LogOut size={15} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <main className="pb-28 pt-24 md:pb-12 md:pt-28">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
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
                    ? "bg-[rgba(201,165,90,0.16)] text-[var(--accent)]"
                    : "text-[var(--text-muted)]",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} strokeWidth={isActive ? 2.4 : 1.8} />
                  <span>{t(item.labelKey)}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
