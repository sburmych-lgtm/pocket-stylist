import { useRef, useState, useCallback } from "react";
import { Camera, ImageUp, ScanLine, Sparkles, X } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (base64: string, mimeType: string) => void;
  disabled?: boolean;
}

export function CameraCapture({ onCapture, disabled }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
    } catch {
      setError("Не вдалося отримати доступ до камери.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStreaming(false);
  }, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const base64 = dataUrl.split(",")[1];
    stopCamera();
    onCapture(base64, "image/jpeg");
  }, [onCapture, stopCamera]);

  const handleFileUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }
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
                Scanner Flow
              </span>
              <h2 className="page-title text-[clamp(2rem,5vw,3.3rem)]">
                Скануйте store finds
                <br />
                як fashion buyer.
              </h2>
              <p className="page-copy">
                Зробіть фото речі, а ми дамо verdict з урахуванням дублювання, color-fit,
                потенціалу нових образів і projected cost-per-wear.
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={disabled}
                  className="primary-action inline-flex items-center gap-2 px-5 py-3 text-sm disabled:opacity-50"
                >
                  <Camera size={16} />
                  Відкрити камеру
                </button>
                <button
                  type="button"
                  onClick={handleFileUpload}
                  disabled={disabled}
                  className="ghost-action inline-flex items-center gap-2 px-5 py-3 text-sm disabled:opacity-50"
                >
                  <ImageUp size={16} />
                  Завантажити фото
                </button>
              </div>

              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            </div>

            <div className="luxe-card p-6">
              <p className="section-subtitle">What you get</p>
              <div className="mt-5 space-y-3">
                {[
                  "BUY / SKIP / CONSIDER verdict з поясненням.",
                  "Кількість схожих речей і колірних дублів у гардеробі.",
                  "Оцінка потенціалу для нових аутфітів ще до покупки.",
                ].map((point) => (
                  <div key={point} className="flex items-start gap-3 rounded-[1.1rem] border border-white/8 bg-white/[0.03] px-4 py-3">
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
            <video ref={videoRef} className="aspect-[4/5] w-full object-cover" autoPlay playsInline muted />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />

            <div className="pointer-events-none absolute inset-6 rounded-[2rem] border border-white/10" />
            <div className="pointer-events-none absolute inset-10">
              <div className="absolute left-0 top-0 h-10 w-10 rounded-tl-[1.6rem] border-l-2 border-t-2 border-[rgba(214,177,111,0.6)]" />
              <div className="absolute right-0 top-0 h-10 w-10 rounded-tr-[1.6rem] border-r-2 border-t-2 border-[rgba(214,177,111,0.6)]" />
              <div className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-[1.6rem] border-b-2 border-l-2 border-[rgba(214,177,111,0.6)]" />
              <div className="absolute bottom-0 right-0 h-10 w-10 rounded-br-[1.6rem] border-b-2 border-r-2 border-[rgba(214,177,111,0.6)]" />
            </div>

            <div className="absolute left-6 top-6 rounded-full border border-white/10 bg-black/35 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/80 backdrop-blur-xl">
              Frame the item
            </div>

            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 px-6 pb-8">
              <div className="rounded-full border border-white/10 bg-black/35 px-5 py-3 text-sm text-white/80 backdrop-blur-xl">
                Зосередьтесь на силуеті, кольорі та фактурі
              </div>
              <div className="flex items-center gap-4">
                <button type="button" onClick={stopCamera} className="icon-action h-12 w-12 bg-black/35 text-white/80">
                  <X size={18} />
                </button>
                <button
                  type="button"
                  onClick={capture}
                  className="spotlight-ring flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-[rgba(214,177,111,0.2)] text-[var(--accent)] transition-transform hover:scale-105 active:scale-95"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[var(--accent)] bg-[rgba(214,177,111,0.18)]">
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
