import { useRef, useState, useCallback } from "react";

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
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStreaming(false);
  }, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
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
    <div className="space-y-4">
      {!streaming ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-[#c9a55a]/20 bg-[#1a1a2e] p-12">
          <div className="text-5xl">{"\uD83D\uDCF8"}</div>
          <p className="text-lg font-medium text-[#f0ece4]">Скануйте річ у магазині</p>
          <p className="text-sm text-[#f0ece4]/45">Зробіть фото для отримання вердикту BUY/SKIP</p>
          <div className="flex gap-3">
            <button onClick={startCamera} disabled={disabled}
              className="gold-btn px-5 py-2.5 text-sm disabled:opacity-50">
              Відкрити камеру
            </button>
            <button onClick={handleFileUpload} disabled={disabled}
              className="gold-ghost-btn px-5 py-2.5 text-sm disabled:opacity-50">
              Завантажити фото
            </button>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} className="w-full" autoPlay playsInline muted />
          {/* Gold corner brackets */}
          <div className="pointer-events-none absolute inset-8">
            <div className="absolute left-0 top-0 h-8 w-8 border-l-2 border-t-2 border-[#c9a55a]/60 rounded-tl" />
            <div className="absolute right-0 top-0 h-8 w-8 border-r-2 border-t-2 border-[#c9a55a]/60 rounded-tr" />
            <div className="absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 border-[#c9a55a]/60 rounded-bl" />
            <div className="absolute bottom-0 right-0 h-8 w-8 border-b-2 border-r-2 border-[#c9a55a]/60 rounded-br" />
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <button onClick={capture}
              className="h-16 w-16 rounded-full border-4 border-[#c9a55a] bg-[#c9a55a]/20
                transition-transform hover:scale-110 active:scale-95" />
          </div>
          <button onClick={stopCamera}
            className="absolute right-4 top-4 rounded-lg bg-black/50 px-3 py-1.5
              text-sm text-white/80 hover:bg-black/70">
            Скасувати
          </button>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
