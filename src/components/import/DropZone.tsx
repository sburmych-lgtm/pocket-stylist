import { useCallback, useState } from "react";
import { CloudUpload, ImagePlus, Sparkles } from "lucide-react";

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export function DropZone({ onFiles, disabled }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (disabled) {
        return;
      }

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith("image/"),
      );

      if (files.length) {
        onFiles(files);
      }
    },
    [disabled, onFiles],
  );

  const handleClick = useCallback(() => {
    if (disabled) {
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*";
    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      if (files.length) {
        onFiles(files);
      }
    };
    input.click();
  }, [disabled, onFiles]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={[
        "luxe-card relative cursor-pointer overflow-hidden p-6 sm:p-8",
        isDragging ? "gold-glow border-[rgba(214,177,111,0.36)]" : "luxe-card-hover",
        disabled ? "cursor-not-allowed opacity-55" : "",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(214,177,111,0.6)] to-transparent" />

      <div className="relative z-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <span className="page-kicker">
            <Sparkles size={14} />
            Atelier Import
          </span>

          <div className="space-y-4">
            <h2 className="page-title text-[clamp(2rem,4vw,3.4rem)]">
              Перетягніть фото,
              <br />
              і ми зберемо fashion archive.
            </h2>
            <p className="page-copy max-w-2xl">
              Обробляємо до 50 фото за раз, визначаємо категорії, тканини, кольори,
              сезонність і готуємо картки до збереження в гардероб.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <span className="metric-pill">
              <CloudUpload size={14} className="text-[var(--accent)]" />
              Drag, drop або tap
            </span>
            <span className="metric-pill">
              <ImagePlus size={14} className="text-[var(--accent-cool)]" />
              JPG, PNG, WebP
            </span>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/8 bg-white/[0.03] p-5 sm:p-6">
          <div
            className={[
              "flex min-h-[18rem] flex-col items-center justify-center rounded-[1.5rem] border border-dashed px-6 py-8 text-center transition-all duration-200",
              isDragging
                ? "border-[rgba(214,177,111,0.55)] bg-[rgba(214,177,111,0.08)]"
                : "border-white/10 bg-[rgba(255,255,255,0.02)]",
            ].join(" ")}
          >
            <div className="spotlight-ring flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-[rgba(214,177,111,0.12)] text-[var(--accent)]">
              {isDragging ? <CloudUpload size={30} /> : <ImagePlus size={30} />}
            </div>
            <h3 className="mt-6 text-xl font-semibold text-[var(--text-primary)]">
              {isDragging ? "Відпустіть фото для аналізу" : "Drop your fashion shots here"}
            </h3>
            <p className="mt-3 max-w-xs text-sm leading-6 text-[var(--text-secondary)]">
              {disabled
                ? "Поточна партія ще обробляється. Зачекайте кілька секунд."
                : "Можна завантажити flat lays, дзеркальні селфі або окремі предмети одягу."}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[rgba(214,177,111,0.24)] bg-[rgba(214,177,111,0.08)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Натисніть для вибору
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
