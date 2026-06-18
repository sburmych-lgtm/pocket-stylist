import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  Camera,
  Shirt,
  Wand2,
  CloudSun,
  Users,
  ScanLine,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { useI18n } from "../i18n";

/**
 * Public landing-style page explaining the product. Mounted at /how-it-works
 * without auth so cold prospects can read it before signing up. Linked from
 * the LoginPage subtitle.
 */
export function HowItWorksPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const steps = [
    { icon: Camera, key: "howItWorks.step1" },
    { icon: Shirt, key: "howItWorks.step2" },
    { icon: Wand2, key: "howItWorks.step3" },
    { icon: CloudSun, key: "howItWorks.step4" },
  ] as const;

  const features = [
    { icon: Sparkles, key: "howItWorks.featureAi" },
    { icon: Users, key: "howItWorks.featureFamily" },
    { icon: ScanLine, key: "howItWorks.featureScanner" },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] transition-colors hover:bg-white/10 hover:text-[var(--text-primary)]"
        >
          <ArrowLeft size={14} />
          {t("common.back")}
        </button>

        {/* Hero */}
        <section className="page-header p-8 sm:p-12">
          <div className="relative z-10 max-w-2xl space-y-5">
            <span className="page-kicker">
              <Sparkles size={14} />
              {t("howItWorks.kicker")}
            </span>
            <h1 className="page-title">{t("howItWorks.heading")}</h1>
            <p className="page-copy">{t("howItWorks.description")}</p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/login"
                className="gold-btn inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold"
              >
                {t("howItWorks.tryFree")}
                <ArrowRight size={15} />
              </Link>
              <Link
                to="/privacy"
                className="ghost-action inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm"
              >
                {t("login.privacyLink")}
              </Link>
            </div>
          </div>
        </section>

        {/* 4 Steps */}
        <section className="mt-10">
          <h2 className="section-title">{t("howItWorks.stepsHeading")}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <div
                key={step.key}
                className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-5"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]">
                  <step.icon size={18} />
                </div>
                <p className="mt-4 text-[0.62rem] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                  {t("import.step")} {i + 1}
                </p>
                <h3 className="mt-1 text-base font-semibold text-[var(--text-primary)]">
                  {t(`${step.key}.title`)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  {t(`${step.key}.copy`)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Differentiators */}
        <section className="mt-10 rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-6 sm:p-8">
          <h2 className="section-title">{t("howItWorks.differentiatorsHeading")}</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            {features.map((f) => (
              <div key={f.key} className="space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)]/12 text-[var(--accent)]">
                  <f.icon size={16} />
                </div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  {t(`${f.key}.title`)}
                </h3>
                <p className="text-sm leading-6 text-[var(--text-secondary)]">
                  {t(`${f.key}.copy`)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-10 flex flex-col items-center gap-4 rounded-[1.4rem] border border-[var(--accent)]/20 bg-[var(--accent)]/[0.04] p-8 text-center">
          <h2 className="font-display text-2xl font-semibold text-[var(--accent)]">
            {t("howItWorks.ctaTitle")}
          </h2>
          <p className="max-w-md text-sm leading-6 text-[var(--text-secondary)]">
            {t("howItWorks.ctaCopy")}
          </p>
          <Link
            to="/login"
            className="gold-btn inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold"
          >
            {t("howItWorks.ctaButton")}
            <ArrowRight size={15} />
          </Link>
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-[var(--text-muted)]">
          <Link to="/privacy" className="hover:text-[var(--accent)]">
            {t("login.privacyLink")}
          </Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-[var(--accent)]">
            {t("login.termsLink")}
          </Link>
          <span>·</span>
          <span>v0.1.0 · {t("howItWorks.betaTag")}</span>
        </footer>
      </div>
    </div>
  );
}
