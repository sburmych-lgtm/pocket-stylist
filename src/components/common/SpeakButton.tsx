import { useEffect, useState } from "react";
import { LoaderCircle, Square, Volume2 } from "lucide-react";
import { useI18n } from "../../i18n";
import { useTTS } from "../../hooks/useTTS";
import type { StylistPersona } from "../../services/api";

interface SpeakButtonProps {
  text: string;
  persona?: StylistPersona;
  className?: string;
}

/**
 * Inline 🔊 button next to AI-authored messages (styling tips, lookbook notes).
 *
 * Click to play. Click while playing to stop. The button hides itself when
 * neither tier is available — never render a control that does nothing.
 *
 * Per CLAUDE.md: never auto-play. Always require a click. We also stop any
 * other in-flight playback before starting this one.
 */
export function SpeakButton({ text, persona = "classic", className }: SpeakButtonProps) {
  const { t } = useI18n();
  const { speak, stop, status, mode } = useTTS();

  // Render-gate the button: hide before we know whether TTS is reachable in
  // any form (server OR browser). `mode` is "browser" by default when
  // SpeechSynthesis exists, so most users see the icon instantly.
  const [hidden, setHidden] = useState(mode === "unavailable");
  useEffect(() => {
    setHidden(mode === "unavailable");
  }, [mode]);

  if (hidden) return null;

  const trimmed = text.trim();
  if (!trimmed) return null;

  const isBusy = status.status === "loading" || status.status === "playing";

  const baseClass =
    "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-[var(--text-secondary)] transition-colors hover:bg-white/[0.08] hover:text-[var(--text-primary)] disabled:opacity-60";

  const handleClick = (): void => {
    if (isBusy) {
      stop();
      return;
    }
    void speak(trimmed, persona);
  };

  const ariaLabel = isBusy ? t("tts.stop") : t("tts.listen");

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${baseClass}${className ? ` ${className}` : ""}`}
      aria-label={ariaLabel}
      title={ariaLabel}
      aria-pressed={isBusy}
    >
      {status.status === "loading" ? (
        <LoaderCircle size={15} className="animate-spin" />
      ) : status.status === "playing" ? (
        <Square size={13} />
      ) : (
        <Volume2 size={15} />
      )}
    </button>
  );
}
