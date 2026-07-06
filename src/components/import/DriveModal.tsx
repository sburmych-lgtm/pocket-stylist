import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Folder, Image as ImageIcon, Loader2, X, ChevronDown } from "lucide-react";
import { driveApi } from "../../services/api";
import type { DriveFile } from "../../services/api";
import { useI18n } from "../../i18n";

interface DriveModalProps {
  open: boolean;
  onClose: () => void;
  onPicked: (files: File[]) => void;
  onAuthorizationRequired?: () => void;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

interface CrumbEntry {
  id: string;
  name: string;
}

export function DriveModal({
  open,
  onClose,
  onPicked,
  onAuthorizationRequired,
}: DriveModalProps) {
  const { t } = useI18n();
  const [crumbs, setCrumbs] = useState<CrumbEntry[]>([{ id: "", name: t("import.drive.myDrive") }]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number } | null>(null);

  const currentFolderId = crumbs[crumbs.length - 1]?.id ?? "";

  const loadFolder = useCallback(
    async (folderId: string, pageToken?: string) => {
      const isPagination = Boolean(pageToken);
      if (isPagination) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setSelected(new Set());
      }
      setError(null);

      try {
        const res = await driveApi.list({ folderId, pageToken });
        setFiles((prev) => (isPagination ? [...prev, ...res.files] : res.files));
        setNextPageToken(res.nextPageToken);
      } catch (err) {
        const message = err instanceof Error ? err.message : t("import.drive.loadError");
        if (message.startsWith("drive_access_")) onAuthorizationRequired?.();
        setError(message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [onAuthorizationRequired, t],
  );

  useEffect(() => {
    if (!open) return;
    void loadFolder(currentFolderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentFolderId]);

  const handleFolderOpen = useCallback((file: DriveFile) => {
    setCrumbs((prev) => [...prev, { id: file.id, name: file.name }]);
  }, []);

  const handleCrumb = useCallback((index: number) => {
    setCrumbs((prev) => prev.slice(0, index + 1));
  }, []);

  const toggleFile = useCallback((file: DriveFile) => {
    if (file.mimeType === FOLDER_MIME) {
      handleFolderOpen(file);
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(file.id)) next.delete(file.id);
      else next.add(file.id);
      return next;
    });
  }, [handleFolderOpen]);

  const handleImport = useCallback(async () => {
    if (selected.size === 0) return;
    setDownloading(true);
    setError(null);
    setDownloadProgress({ done: 0, total: selected.size });

    const imported: File[] = [];
    const selectedFiles = files.filter((f) => selected.has(f.id));
    let done = 0;

    for (const file of selectedFiles) {
      try {
        const { base64, mimeType, fileName } = await driveApi.download(file.id);
        const byteStr = atob(base64);
        const bytes = new Uint8Array(byteStr.length);
        for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
        imported.push(new File([bytes], fileName, { type: mimeType }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (message.startsWith("drive_access_")) onAuthorizationRequired?.();
        console.error("[DRIVE] download failed for", file.name, err);
      }
      done += 1;
      setDownloadProgress({ done, total: selected.size });
    }

    setDownloading(false);
    setDownloadProgress(null);

    if (imported.length === 0) {
      setError(t("import.drive.allFailed"));
      return;
    }

    onPicked(imported);
    setSelected(new Set());
    onClose();
  }, [selected, files, onPicked, onClose, onAuthorizationRequired, t]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("import.drive.pickerTitle")}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/[0.06] bg-[var(--bg-surface)] shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {t("import.drive.pickerTitle")}
            </h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {t("import.drive.pickerSubtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={downloading}
            aria-label={t("common.close")}
            className="rounded-full p-2 text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Breadcrumbs */}
        <div className="flex flex-wrap items-center gap-1 border-b border-white/[0.04] px-6 py-3 text-sm">
          {crumbs.length > 1 && (
            <button
              type="button"
              onClick={() => handleCrumb(crumbs.length - 2)}
              disabled={loading || downloading}
              className="mr-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[var(--text-primary)] disabled:opacity-50"
              aria-label={t("common.back")}
            >
              <ArrowLeft size={14} />
            </button>
          )}
          {crumbs.map((c, i) => (
            <span key={`${c.id}-${i}`} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleCrumb(i)}
                disabled={loading || downloading || i === crumbs.length - 1}
                className={`rounded-full px-2 py-1 transition-colors ${
                  i === crumbs.length - 1
                    ? "font-semibold text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:bg-white/10 hover:text-[var(--text-primary)]"
                }`}
              >
                {c.name}
              </button>
              {i < crumbs.length - 1 && <span className="text-[var(--text-muted)]">/</span>}
            </span>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-3 rounded-2xl border border-[var(--danger)]/20 bg-[var(--danger)]/5 px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex h-40 items-center justify-center text-[var(--text-secondary)]">
              <Loader2 size={20} className="mr-2 animate-spin text-[var(--accent)]" />
              {t("common.loading")}
            </div>
          ) : files.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-[var(--text-muted)]">
              {t("import.drive.empty")}
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {files.map((file) => {
                const isFolder = file.mimeType === FOLDER_MIME;
                const isSelected = selected.has(file.id);
                return (
                  <li key={file.id}>
                    <button
                      type="button"
                      onClick={() => toggleFile(file)}
                      disabled={downloading}
                      className={`group flex h-full w-full flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-all duration-200 disabled:opacity-50 ${
                        isSelected
                          ? "border-[var(--accent)]/60 bg-[rgba(201,165,90,0.12)]"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex h-20 w-full items-center justify-center overflow-hidden rounded-xl bg-white/[0.04]">
                        {isFolder ? (
                          <Folder size={32} className="text-[var(--accent)]" />
                        ) : file.thumbnailLink ? (
                          <img
                            src={file.thumbnailLink}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon size={28} className="text-[var(--text-muted)]" />
                        )}
                      </div>
                      <span
                        className="line-clamp-2 text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
                        title={file.name}
                      >
                        {file.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {nextPageToken && !loading && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => void loadFolder(currentFolderId, nextPageToken)}
                disabled={loadingMore || downloading}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                {loadingMore ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ChevronDown size={14} />
                )}
                {t("import.drive.loadMore")}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-6 py-4">
          <p className="text-xs text-[var(--text-secondary)]">
            {downloadProgress
              ? t("import.drive.downloading", {
                  done: String(downloadProgress.done),
                  total: String(downloadProgress.total),
                })
              : t("import.drive.selectedCount", { count: String(selected.size) })}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={downloading}
              className="rounded-full border border-white/10 bg-transparent px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-white/5 disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={downloading || selected.size === 0}
              className="gold-btn inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : null}
              {t("import.drive.importBtn")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
