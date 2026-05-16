import { useCallback, useEffect, useRef, useState } from "react";
import { CloudUpload, ImagePlus, Sparkles, HardDrive, Loader2 } from "lucide-react";
import { useI18n } from "../../i18n";
import { getAppStatus, getToken } from "../../services/api";
import { DriveModal } from "./DriveModal";

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

interface PickerDoc {
  id: string;
  name: string;
  mimeType: string;
}

declare global {
  interface Window {
    gapi?: { load(api: string, cb: () => void): void };
    google?: {
      accounts: {
        id: {
          initialize(config: Record<string, unknown>): void;
          renderButton(el: HTMLElement, config: Record<string, unknown>): void;
        };
      };
      picker: {
        PickerBuilder: new () => PickerBuilder;
        ViewId: { DOCS_IMAGES: string };
        Action: { PICKED: string; CANCEL: string };
        Feature: { MULTISELECT_ENABLED: string };
      };
    };
  }
}

interface PickerBuilder {
  addView(view: string): PickerBuilder;
  enableFeature(feature: string): PickerBuilder;
  setAppId(appId: string): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setCallback(cb: (data: { action: string; docs?: PickerDoc[] }) => void): PickerBuilder;
  build(): { setVisible(v: boolean): void };
}

export function DropZone({ onFiles, disabled }: DropZoneProps) {
  const { t } = useI18n();
  const [isDragging, setIsDragging] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [googlePickerApiKey, setGooglePickerApiKey] = useState<string | null>(null);
  const [googleDriveAvailable, setGoogleDriveAvailable] = useState(false);
  const [usePicker, setUsePicker] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  // null = not checked yet; true = user already granted Drive scope; false = need consent
  const [driveReady, setDriveReady] = useState<boolean | null>(null);
  const pickerScriptLoaded = useRef(false);

  // Probe whether the current user already has a Google access token (i.e.
  // they ran the drive-consent flow before). If yes — show "Import"; if no —
  // show "Connect Google Drive" which redirects to /api/auth/google/drive-consent.
  useEffect(() => {
    if (!getToken()) {
      setDriveReady(false);
      return;
    }
    fetch("/api/auth/google-access-token", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => setDriveReady(r.ok))
      .catch(() => setDriveReady(false));
  }, []);

  // Auto-open Drive picker after the user comes back from the consent screen.
  useEffect(() => {
    if (driveReady !== true) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("driveGranted") === "1") {
      window.history.replaceState({}, "", window.location.pathname);
      setModalOpen(true);
    }
  }, [driveReady]);

  useEffect(() => {
    getAppStatus()
      .then((s) => {
        setGoogleClientId(s.googleClientId ?? null);
        setGooglePickerApiKey(s.googlePickerApiKey ?? null);
        setGoogleDriveAvailable(s.googleDriveConfigured);
        setUsePicker(s.googleDrivePickerConfigured);
      })
      .catch(() => {
        setGoogleClientId(null);
        setGooglePickerApiKey(null);
        setGoogleDriveAvailable(false);
        setUsePicker(false);
      });
  }, []);

  // Load Google Picker API script when Picker is available
  useEffect(() => {
    if (!usePicker || pickerScriptLoaded.current) return;
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = () => {
      window.gapi?.load("picker", () => {
        pickerScriptLoaded.current = true;
      });
    };
    document.head.appendChild(script);
  }, [usePicker]);

  const openPicker = useCallback(async () => {
    setDriveError(null);
    setDriveLoading(true);
    try {
      // Get access token from server
      const tokenRes = await fetch("/api/auth/google-access-token", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ??
            t("import.drive.reauthHint"),
        );
      }
      const { accessToken } = (await tokenRes.json()) as { accessToken: string };

      if (!window.google?.picker || !googleClientId || !googlePickerApiKey) {
        throw new Error("Google Picker not loaded");
      }

      const appId = googleClientId.split("-")[0];
      const picker = new window.google.picker.PickerBuilder()
        .addView(window.google.picker.ViewId.DOCS_IMAGES)
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
        .setAppId(appId)
        .setOAuthToken(accessToken)
        .setDeveloperKey(googlePickerApiKey)
        .setCallback(async (data) => {
          if (data.action !== window.google!.picker.Action.PICKED || !data.docs) return;

          setDriveLoading(true);
          try {
            const files: File[] = [];
            for (const doc of data.docs) {
              const res = await fetch("/api/import/drive-download", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${getToken()}`,
                },
                body: JSON.stringify({ fileId: doc.id }),
              });
              if (!res.ok) continue;
              const { base64, mimeType, fileName } = (await res.json()) as {
                base64: string;
                mimeType: string;
                fileName: string;
              };
              const byteStr = atob(base64);
              const bytes = new Uint8Array(byteStr.length);
              for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
              files.push(new File([bytes], fileName, { type: mimeType }));
            }
            if (files.length) onFiles(files);
            else setDriveError(t("import.drive.allFailed"));
          } finally {
            setDriveLoading(false);
          }
        })
        .build();

      picker.setVisible(true);
      setDriveLoading(false);
    } catch (err) {
      console.error("Google Drive picker error:", err);
      setDriveError((err as Error).message);
      setDriveLoading(false);
    }
  }, [googleClientId, googlePickerApiKey, onFiles, t]);

  const handleGoogleDriveClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled || driveLoading || !googleDriveAvailable) return;
      setDriveError(null);

      // User hasn't granted Drive scope yet — bounce them through the
      // incremental consent flow. The server callback brings them back to
      // /import?driveGranted=1, where the auto-open effect fires.
      if (driveReady === false) {
        const returnTo = window.location.pathname || "/import";
        window.location.href = `/api/auth/google/drive-consent?returnTo=${encodeURIComponent(returnTo)}`;
        return;
      }

      if (usePicker) {
        void openPicker();
      } else {
        setModalOpen(true);
      }
    },
    [disabled, driveLoading, googleDriveAvailable, usePicker, openPicker, driveReady],
  );

  const handleModalPicked = useCallback(
    (files: File[]) => {
      if (files.length) {
        setDriveError(null);
        onFiles(files);
      }
    },
    [onFiles],
  );

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
        setDriveError(null);
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
        setDriveError(null);
        onFiles(files);
      }
    };
    input.click();
  }, [disabled, onFiles]);

  return (
    <>
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
              {googleDriveAvailable && (
                <button
                  type="button"
                  onClick={handleGoogleDriveClick}
                  disabled={disabled || driveLoading || driveReady === null}
                  className="metric-pill cursor-pointer transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {driveLoading || driveReady === null ? (
                    <Loader2 size={14} className="animate-spin text-[var(--accent)]" />
                  ) : (
                    <HardDrive size={14} className="text-[var(--accent)]" />
                  )}
                  {driveLoading
                    ? t("common.loading")
                    : driveReady === false
                      ? t("import.dropzone.connectGoogleDrive")
                      : t("import.dropzone.googleDrive")}
                </button>
              )}
            </div>

            {driveError && (
              <p
                role="alert"
                className="rounded-2xl border border-[rgba(239,138,128,0.22)] bg-[rgba(239,138,128,0.08)] px-4 py-3 text-sm text-[var(--danger)]"
              >
                {driveError}
              </p>
            )}
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

      <DriveModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onPicked={handleModalPicked}
      />
    </>
  );
}
