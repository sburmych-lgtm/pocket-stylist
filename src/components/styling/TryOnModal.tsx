import { useCallback, useEffect, useRef, useState } from "react";
import { X, Sparkles, Upload, Loader2, AlertTriangle, Download } from "lucide-react";
import { stylingApi } from "../../services/api";
import { compressImageToBase64 } from "../../utils/imageCompress";
import { useI18n } from "../../i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Garment image (already on Cloudinary or data URL). */
  garmentImageUrl: string;
  garmentLabel?: string;
}

type Phase =
  | { status: "select-selfie" }
  | { status: "generating"; startedAt: number }
  | { status: "success"; imageUrl: string; durationMs: number }
  | { status: "error"; error: string };

export function TryOnModal({ open, onClose, garmentImageUrl, garmentLabel }: Props) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>({ status: "select-selfie" });
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // No reset effect: the parent passes a `key` that changes when the modal
  // is reopened, which remounts this tree and resets state naturally —
  // avoids the React 19 cascading-render warning around setState-in-effect.

  const handleSelfie = useCallback(
    async (file: File) => {
      setSelfiePreview(URL.createObjectURL(file));
      setPhase({ status: "generating", startedAt: Date.now() });
      try {
        const base64 = await compressImageToBase64(file, 1024, 0.85);
        const dataUrl = `data:image/jpeg;base64,${base64}`;
        const result = await stylingApi.tryOn(dataUrl, garmentImageUrl);
        setPhase({ status: "success", imageUrl: result.imageUrl, durationMs: result.durationMs });
      } catch (err) {
        const message = err instanceof Error ? err.message : "tryon_failed";
        let userMsg = t("tryon.errors.generic");
        if (message === "tryon_not_configured") userMsg = t("tryon.errors.notConfigured");
        else if (message === "rate_limit_exceeded") userMsg = t("tryon.errors.rateLimit");
        else if (message === "timeout") userMsg = t("tryon.errors.timeout");
        setPhase({ status: "error", error: userMsg });
      }
    },
    [garmentImageUrl, t],
  );

  const openPicker = useCallback(() => fileRef.current?.click(), []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tryon-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/[0.06] bg-[var(--bg-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div>
            <h2 id="tryon-title" className="text-lg font-semibold text-[var(--text-primary)]">
              {t("tryon.title")}
            </h2>
            {garmentLabel && (
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{garmentLabel}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="rounded-full p-2 text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text-primary)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {phase.status === "select-selfie" && (
            <div className="space-y-4 text-center">
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                {t("tryon.instructions")}
              </p>
              <button
                type="button"
                onClick={openPicker}
                className="gold-btn inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
              >
                <Upload size={16} />
                {t("tryon.uploadSelfie")}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.heic,.heif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleSelfie(file);
                }}
              />
              <p className="text-[11px] text-[var(--text-muted)]">{t("tryon.privacyHint")}</p>
            </div>
          )}

          {phase.status === "generating" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              {selfiePreview && (
                <img
                  src={selfiePreview}
                  alt=""
                  className="h-32 w-32 rounded-2xl object-cover opacity-80"
                />
              )}
              <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
              <p className="text-sm text-[var(--text-primary)]">{t("tryon.generating")}</p>
              <p className="text-xs text-[var(--text-muted)]">{t("tryon.generatingHint")}</p>
            </div>
          )}

          {phase.status === "success" && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
                <img
                  src={phase.imageUrl}
                  alt={t("tryon.resultAlt")}
                  className="w-full"
                  loading="lazy"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                <p className="flex items-center gap-1.5">
                  <Sparkles size={12} className="text-[var(--accent)]" />
                  {t("tryon.generatedIn", { ms: Math.round(phase.durationMs / 100) / 10 + "s" })}
                </p>
                <a
                  href={phase.imageUrl}
                  download="tryon.jpg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-semibold hover:bg-white/10"
                >
                  <Download size={12} />
                  {t("matching.download")}
                </a>
              </div>
              <button
                type="button"
                onClick={() => setPhase({ status: "select-selfie" })}
                className="ghost-action w-full rounded-full px-4 py-2.5 text-xs"
              >
                {t("tryon.tryAgain")}
              </button>
            </div>
          )}

          {phase.status === "error" && (
            <div className="space-y-3">
              <div
                role="alert"
                className="flex items-start gap-3 rounded-2xl border border-[var(--danger)]/24 bg-[var(--danger)]/8 px-4 py-3 text-sm text-[var(--danger)]"
              >
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <p>{phase.error}</p>
              </div>
              <button
                type="button"
                onClick={() => setPhase({ status: "select-selfie" })}
                className="ghost-action w-full rounded-full px-4 py-2.5 text-xs"
              >
                {t("tryon.tryAgain")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
