import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { useI18n } from "../i18n";

interface Props {
  /** Public URL to fetch (PRIVACY.md or TERMS.md served from /public via Vite). */
  docPath: string;
  titleKey: string;
}

/**
 * Renders a Markdown legal document (Privacy, Terms) as a minimal styled
 * page. We don't pull in a Markdown library — the legal text is hand-
 * crafted, ASCII-only formatting, so plain-text + `<pre>` is enough and
 * keeps the bundle tiny.
 */
export function LegalPage({ docPath, titleKey }: Props) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(docPath)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((txt) => {
        if (!cancelled) setDoc(txt);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "load failed");
      });
    return () => {
      cancelled = true;
    };
  }, [docPath]);

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition-colors hover:bg-white/10 hover:text-[var(--text-primary)]"
        >
          <ArrowLeft size={14} />
          {t("common.back")}
        </button>

        <header className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]">
            <FileText size={20} />
          </div>
          <h1 className="font-display text-3xl font-semibold text-[var(--accent)]">
            {t(titleKey)}
          </h1>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-[var(--danger)]/20 bg-[var(--danger)]/5 px-4 py-3 text-sm text-[var(--danger)]"
          >
            {error}
          </div>
        )}

        {doc ? (
          <article className="luxe-card p-6 sm:p-8">
            <pre
              className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-[var(--text-primary)]"
              style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
            >
              {doc}
            </pre>
          </article>
        ) : (
          !error && (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
            </div>
          )
        )}
      </div>
    </div>
  );
}
