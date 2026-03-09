import { useCallback, useState } from "react";

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export function DropZone({ onFiles, disabled }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

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
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
      if (files.length) onFiles(files);
    },
    [onFiles, disabled],
  );

  const handleClick = useCallback(() => {
    if (disabled) return;
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*";
    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      if (files.length) onFiles(files);
    };
    input.click();
  }, [onFiles, disabled]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        flex cursor-pointer flex-col items-center justify-center
        rounded-2xl border-2 border-dashed p-12 transition-all duration-300
        ${isDragging
          ? "border-[#c9a55a] bg-[#c9a55a]/5 gold-glow"
          : "border-[#c9a55a]/20 bg-[#1a1a2e] hover:border-[#c9a55a]/40 hover:bg-[#1a1a2e]/80"
        }
        ${disabled ? "cursor-not-allowed opacity-50" : ""}
      `}
    >
      <div className="mb-4 text-5xl">
        {isDragging ? "\u{1F4E5}" : "\u{1F4F7}"}
      </div>
      <p className="text-lg font-medium text-[#f0ece4]">
        {isDragging ? "Відпустіть фото тут" : "Перетягніть фото одягу"}
      </p>
      <p className="mt-1 text-sm text-[#f0ece4]/45">
        або натисніть для вибору — до 50 фото за раз
      </p>
      <p className="mt-3 text-xs text-[#f0ece4]/25">
        JPG, PNG, WebP
      </p>
    </div>
  );
}
