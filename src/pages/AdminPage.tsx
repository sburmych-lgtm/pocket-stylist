import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";
import { authApi } from "../services/api";

const PASSWORD_MIN_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Private owner tool (route /admin). Lets an ADMIN_EMAILS account reset any
 * user's password without an email service — the admin just hands the new
 * password to the user. Non-admins get a 403 from the server.
 */
export function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setDone(null);
      const targetEmail = email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(targetEmail)) {
        setError("Введіть коректний email користувача.");
        return;
      }
      if (password.length < PASSWORD_MIN_LENGTH) {
        setError(`Пароль має містити щонайменше ${PASSWORD_MIN_LENGTH} символів.`);
        return;
      }
      setBusy(true);
      try {
        const r = await authApi.adminResetPassword(targetEmail, password);
        setDone(r.email);
        setPassword("");
      } catch (err) {
        const code = err instanceof Error ? err.message : "";
        setError(
          code === "forbidden"
            ? "Немає прав. Увійдіть акаунтом-адміністратором."
            : code === "user_not_found"
              ? "Користувача з таким email не знайдено."
              : code === "password_too_short"
                ? `Пароль надто короткий (мінімум ${PASSWORD_MIN_LENGTH}).`
                : "Не вдалося змінити пароль. Спробуйте ще раз.",
        );
      } finally {
        setBusy(false);
      }
    },
    [email, password],
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] px-4 py-10">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,165,90,0.05)_0%,transparent_60%)]" />

      <div className="animate-fade-in-up relative w-full max-w-sm rounded-3xl border border-white/[0.06] bg-[var(--bg-surface)] p-8 shadow-2xl shadow-black/40">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-semibold tracking-wide text-[var(--accent)]">
            Скидання пароля
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Введіть email користувача і новий пароль. Після зміни передайте новий
            пароль користувачу — жодних листів не потрібно.
          </p>
        </div>

        <form className="space-y-4" onSubmit={submit} noValidate>
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/5 px-4 py-3 text-center text-sm text-[var(--danger)]"
            >
              {error}
            </div>
          )}
          {done && (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-4 py-3 text-sm text-[var(--text-primary)]">
              <CheckCircle2 size={18} className="shrink-0 text-[var(--accent)]" />
              <span>
                Пароль для <b>{done}</b> змінено. Передайте новий пароль користувачу.
              </span>
            </div>
          )}

          <input
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email користувача"
            required
            disabled={busy}
            className="w-full rounded-full border border-white/10 bg-white/5 py-3 px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:border-[var(--accent)]/40 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 disabled:opacity-50"
          />
          <input
            type="text"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`новий пароль (мінімум ${PASSWORD_MIN_LENGTH} символів)`}
            required
            disabled={busy}
            className="w-full rounded-full border border-white/10 bg-white/5 py-3 px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:border-[var(--accent)]/40 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={busy}
            className="gold-btn flex w-full items-center justify-center gap-2 rounded-full px-4 py-3.5 text-sm font-semibold disabled:opacity-50"
          >
            <KeyRound size={16} />
            {busy ? "Зберігаємо…" : "Встановити новий пароль"}
          </button>
        </form>

        <div className="mt-6 border-t border-white/[0.05] pt-4 text-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)]"
          >
            <ArrowLeft size={14} />
            На головну
          </Link>
        </div>
      </div>
    </div>
  );
}
