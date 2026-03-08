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

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/"),
      );
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
        rounded-2xl border-2 border-dashed p-12 transition-all
        ${isDragging
          ? "border-indigo-400 bg-indigo-50"
          : "border-neutral-300 bg-white hover:border-neutral-400 hover:bg-neutral-50"
        }
        ${disabled ? "cursor-not-allowed opacity-50" : ""}
      `}
    >
      <div className="mb-4 text-5xl">
        {isDragging ? "\u{1F4E5}" : "\u{1F4F7}"}
      </div>
      <p className="text-lg font-medium text-neutral-700">
        {isDragging ? "Drop photos here" : "Drag & drop clothing photos"}
      </p>
      <p className="mt-1 text-sm text-neutral-500">
        or click to browse — up to 50 photos at once
      </p>
      <p className="mt-3 text-xs text-neutral-400">
        JPG, PNG, WebP supported
      </p>
    </div>
  );
}
