import { useCallback, useState } from "react";
import { CloudUpload, ImagePlus, Sparkles } from "lucide-react";
import { useI18n } from "../../i18n";

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export function DropZone({ onFiles, disabled }: DropZoneProps) {
  const { t } = useI18n();
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
        isDragging ? "gold-glow border-[rgba(201,165,90,0.36)]" : "luxe-card-hover",
        disabled ? "cursor-not-allowed opacity-55" : "",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,165,90,0.6)] to-transparent" />

      <div className="relative z-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <span className="page-kicker">
            <Sparkles size={14} />
            {t("import.dropzone.kicker")}
          </span>

          <div className="space-y-4">
            <h2 className="page-title text-[clamp(2rem,4vw,3.4rem)]">
              {t("import.dropzone.heading").split("\n").map((line, i) => (
                <span key={i}>{i > 0 && <br />}{line}</span>
              ))}
            </h2>
            <p className="page-copy max-w-2xl">
              {t("import.dropzone.description")}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <span className="metric-pill">
              <CloudUpload size={14} className="text-[var(--accent)]" />
              {t("import.dropzone.dragDrop")}
            </span>
            <span className="metric-pill">
              <ImagePlus size={14} className="text-[var(--accent-cool)]" />
              {t("import.dropzone.formats")}
            </span>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/8 bg-white/[0.03] p-5 sm:p-6">
          <div
            className={[
              "flex min-h-[18rem] flex-col items-center justify-center rounded-[1.5rem] border border-dashed px-6 py-8 text-center transition-all duration-200",
              isDragging
                ? "border-[rgba(201,165,90,0.55)] bg-[rgba(201,165,90,0.08)]"
                : "border-white/10 bg-[rgba(255,255,255,0.02)]",
            ].join(" ")}
          >
            <div className="spotlight-ring flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-[rgba(201,165,90,0.12)] text-[var(--accent)]">
              {isDragging ? <CloudUpload size={30} /> : <ImagePlus size={30} />}
            </div>
            <h3 className="mt-6 text-xl font-semibold text-[var(--text-primary)]">
              {isDragging ? t("import.dropzone.titleDragging") : t("import.dropzone.title")}
            </h3>
            <p className="mt-3 max-w-xs text-sm leading-6 text-[var(--text-secondary)]">
              {disabled
                ? t("import.dropzone.descDisabled")
                : t("import.dropzone.desc")}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[rgba(201,165,90,0.24)] bg-[rgba(201,165,90,0.08)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              {t("import.dropzone.clickToSelect")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
