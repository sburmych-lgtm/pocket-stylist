import { useRef, useState, useCallback, useEffect } from "react";
import { Camera, ImageUp, ScanLine, Sparkles, X } from "lucide-react";
import { useI18n } from "../../i18n";

interface CameraCaptureProps {
  onCapture: (base64: string, mimeType: string) => void;
  disabled?: boolean;
}

/**
 * Maps a DOMException from navigator.mediaDevices.getUserMedia into a
 * user-facing i18n key. Without this, every camera failure looked
 * identical ("Не вдалося отримати доступ"), which left users with no
 * way to know whether they had to grant a permission, switch device,
 * or try a different browser.
 */
function cameraErrorKey(err: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "scanner.cameraNotSecure";
  }
  if (
    typeof navigator !== "undefined" &&
    !navigator.mediaDevices?.getUserMedia
  ) {
    return "scanner.cameraUnsupported";
  }
  if (err && typeof err === "object" && "name" in err) {
    const name = (err as { name: string }).name;
    switch (name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "scanner.cameraDenied";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "scanner.cameraNotFound";
      case "NotReadableError":
      case "TrackStartError":
        return "scanner.cameraBusy";
      case "OverconstrainedError":
      case "ConstraintNotSatisfiedError":
        return "scanner.cameraConstraint";
      case "SecurityError":
        return "scanner.cameraNotSecure";
      case "AbortError":
        return "scanner.cameraAborted";
      default:
        return "scanner.cameraError";
    }
  }
  return "scanner.cameraError";
}

export function CameraCapture({ onCapture, disabled }: CameraCaptureProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported] = useState<boolean>(
    typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
  );
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
  }, []);

  // Cleanup on unmount so the camera LED doesn't stay green if the user
  // navigates away mid-session.
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);

    if (!supported) {
      setError(t("scanner.cameraUnsupported"));
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError(t("scanner.cameraNotSecure"));
      return;
    }

    setStarting(true);
    try {
      // Prefer rear camera with a reasonable size; if the rear cam isn't
      // available we retry without facingMode so laptops still work.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (preferErr) {
        // Some laptops throw OverconstrainedError when no rear cam exists.
        if (
          preferErr instanceof DOMException &&
          (preferErr.name === "OverconstrainedError" ||
            preferErr.name === "ConstraintNotSatisfiedError")
        ) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } else {
          throw preferErr;
        }
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await new Promise<void>((resolve, reject) => {
          let settled = false;
          const finalize = (err?: unknown) => {
            if (settled) return;
            settled = true;
            if (err) reject(err);
            else resolve();
          };
          video.onloadedmetadata = () => {
            video.play().then(() => finalize()).catch(finalize);
          };
          // Guard against onloadedmetadata never firing (rare iOS hang).
          setTimeout(() => finalize(new DOMException("AbortError", "AbortError")), 8000);
        });
      }
      setStreaming(true);
    } catch (err) {
      console.error("[camera] getUserMedia failed:", err);
      stopCamera();
      setError(t(cameraErrorKey(err)));
    } finally {
      setStarting(false);
    }
  }, [supported, stopCamera, t]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (!video.videoWidth || !video.videoHeight) {
      // Frame isn't ready yet — bail silently rather than send a 0×0 image.
      setError(t("scanner.cameraNotReady"));
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const base64 = dataUrl.split(",")[1];
    stopCamera();
    onCapture(base64, "image/jpeg");
  }, [onCapture, stopCamera, t]);

  const handleFileUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        onCapture(result.split(",")[1], file.type);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [onCapture]);

  return (
    <div className="space-y-5">
      {!streaming ? (
        <section className="page-header p-6 sm:p-8">
          <div className="relative z-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <span className="page-kicker">
                <ScanLine size={14} />
                {t("scanner.cameraKicker")}
              </span>
              <h2 className="page-title text-[clamp(2rem,5vw,3.3rem)]">
                {t("scanner.cameraHeading").split("\n").map((line, i) => (
                  <span key={i}>{i > 0 && <br />}{line}</span>
                ))}
              </h2>
              <p className="page-copy">{t("scanner.cameraDesc")}</p>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={disabled || starting || !supported}
                  className="primary-action inline-flex items-center gap-2 px-5 py-3 text-sm disabled:opacity-50"
                  title={!supported ? t("scanner.cameraUnsupported") : undefined}
                >
                  <Camera size={16} />
                  {starting ? t("scanner.cameraStarting") : t("scanner.openCamera")}
                </button>
                <button
                  type="button"
                  onClick={handleFileUpload}
                  disabled={disabled}
                  className="ghost-action inline-flex items-center gap-2 px-5 py-3 text-sm disabled:opacity-50"
                >
                  <ImageUp size={16} />
                  {t("scanner.uploadPhoto")}
                </button>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-2xl border border-[rgba(239,138,128,0.22)] bg-[rgba(239,138,128,0.08)] px-4 py-3 text-sm leading-6 text-[var(--danger)]"
                >
                  {error}
                  <p className="mt-2 text-xs opacity-80">{t("scanner.cameraFallbackHint")}</p>
                </div>
              )}
            </div>

            <div className="luxe-card p-6">
              <p className="section-subtitle">{t("scanner.whatYouGet")}</p>
              <div className="mt-5 space-y-3">
                {[t("scanner.tip1"), t("scanner.tip2"), t("scanner.tip3")].map((point) => (
                  <div
                    key={point}
                    className="flex items-start gap-3 rounded-[1.1rem] border border-white/8 bg-white/[0.03] px-4 py-3"
                  >
                    <span className="mt-2 h-2 w-2 rounded-full bg-[var(--accent)]" />
                    <p className="text-sm leading-6 text-[var(--text-secondary)]">{point}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="luxe-card overflow-hidden">
          <div className="relative bg-black">
            <video
              ref={videoRef}
              className="aspect-[4/5] w-full object-cover"
              autoPlay
              playsInline
              muted
            />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />

            <div className="pointer-events-none absolute inset-6 rounded-[2rem] border border-white/10" />
            <div className="pointer-events-none absolute inset-10">
              <div className="absolute left-0 top-0 h-10 w-10 rounded-tl-[1.6rem] border-l-2 border-t-2 border-[rgba(201,165,90,0.6)]" />
              <div className="absolute right-0 top-0 h-10 w-10 rounded-tr-[1.6rem] border-r-2 border-t-2 border-[rgba(201,165,90,0.6)]" />
              <div className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-[1.6rem] border-b-2 border-l-2 border-[rgba(201,165,90,0.6)]" />
              <div className="absolute bottom-0 right-0 h-10 w-10 rounded-br-[1.6rem] border-b-2 border-r-2 border-[rgba(201,165,90,0.6)]" />
            </div>

            <div className="absolute left-6 top-6 rounded-full border border-white/10 bg-black/35 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/80 backdrop-blur-xl">
              {t("scanner.frameItem")}
            </div>

            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 px-6 pb-8">
              <div className="rounded-full border border-white/10 bg-black/35 px-5 py-3 text-sm text-white/80 backdrop-blur-xl">
                {t("scanner.focusHint")}
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="icon-action h-12 w-12 bg-black/35 text-white/80"
                  aria-label={t("common.close")}
                >
                  <X size={18} />
                </button>
                <button
                  type="button"
                  onClick={capture}
                  className="spotlight-ring flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-[rgba(201,165,90,0.2)] text-[var(--accent)] transition-transform hover:scale-105 active:scale-95"
                  aria-label={t("scanner.cameraCapture")}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[var(--accent)] bg-[rgba(201,165,90,0.18)]">
                    <Sparkles size={20} />
                  </div>
                </button>
                <div className="h-12 w-12" />
              </div>
            </div>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
