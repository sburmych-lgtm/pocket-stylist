/**
 * Share utility — uses Web Share API when available, falls back to download.
 */

function canShareFiles(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function"
  );
}

export async function shareImage(
  blob: Blob,
  title: string,
): Promise<boolean> {
  const file = new File([blob], "style-match.png", { type: "image/png" });

  if (canShareFiles() && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return true;
    } catch (err) {
      // User cancelled or share failed — fall through to download
      if ((err as DOMException).name === "AbortError") return false;
    }
  }

  downloadBlob(blob, "style-match.png");
  return false;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
