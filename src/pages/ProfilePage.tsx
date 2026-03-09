import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { profileApi } from "../services/api";
import type {
  ColorAnalysisResult,
  ColorPaletteEntry,
  UserProfile,
} from "../services/api";
import { useI18n } from "../i18n";

/* ---------- Season display map ---------- */

const SEASON_EMOJI: Record<string, string> = {
  "Bright Spring": "🌻",
  "True Spring": "🌷",
  "Light Spring": "🌸",
  "Light Summer": "☀️",
  "True Summer": "🌊",
  "Soft Summer": "🌫️",
  "Soft Autumn": "🍂",
  "True Autumn": "🍁",
  "Deep Autumn": "🌾",
  "Deep Winter": "❄️",
  "True Winter": "🌨️",
  "Bright Winter": "✨",
};

const SEASON_KEY: Record<string, string> = {
  "Bright Spring": "profile.seasonBrightSpring",
  "True Spring": "profile.seasonTrueSpring",
  "Light Spring": "profile.seasonLightSpring",
  "Light Summer": "profile.seasonLightSummer",
  "True Summer": "profile.seasonTrueSummer",
  "Soft Summer": "profile.seasonSoftSummer",
  "Soft Autumn": "profile.seasonSoftAutumn",
  "True Autumn": "profile.seasonTrueAutumn",
  "Deep Autumn": "profile.seasonDeepAutumn",
  "Deep Winter": "profile.seasonDeepWinter",
  "True Winter": "profile.seasonTrueWinter",
  "Bright Winter": "profile.seasonBrightWinter",
};

const UNDERTONE_KEY: Record<string, string> = {
  warm: "profile.undertoneWarm",
  cool: "profile.undertoneCool",
  neutral: "profile.undertoneNeutral",
};

const CONTRAST_KEY: Record<string, string> = {
  high: "profile.contrastHigh",
  medium: "profile.contrastMedium",
  low: "profile.contrastLow",
};

/* ---------- Sub-components ---------- */

function ColorCircle({
  color,
  crossed,
}: {
  color: ColorPaletteEntry;
  crossed?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <div
          className="h-12 w-12 rounded-full border-2 border-white/[0.1] shadow-md shadow-black/30"
          style={{ backgroundColor: color.hex }}
        />
        {crossed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-14 w-0.5 rotate-45 bg-red-500" />
          </div>
        )}
      </div>
      <span className="max-w-16 text-center text-xs leading-tight text-[#f0ece4]/55">
        {color.name}
      </span>
    </div>
  );
}

function ColorResultDisplay({
  result,
  palette,
  avoid,
}: {
  result: { season: string; undertone: string; contrast: string; description: string };
  palette: ColorPaletteEntry[];
  avoid: ColorPaletteEntry[];
}) {
  const { t } = useI18n();
  const emoji = SEASON_EMOJI[result.season] ?? "🎨";
  const seasonLabel = SEASON_KEY[result.season] ? t(SEASON_KEY[result.season]) : result.season;
  const undertoneLabel = UNDERTONE_KEY[result.undertone] ? t(UNDERTONE_KEY[result.undertone]) : result.undertone;
  const contrastLabel = CONTRAST_KEY[result.contrast] ? t(CONTRAST_KEY[result.contrast]) : result.contrast;

  return (
    <div className="space-y-6">
      {/* Season header */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-[#f0ece4]">
          {emoji} {seasonLabel}
        </h3>
        <p className="mt-1 text-sm text-[#f0ece4]/45">{result.season}</p>
      </div>

      {/* Badges */}
      <div className="flex justify-center gap-3">
        <span className="rounded-full bg-[#c9a55a]/10 px-3 py-1 text-sm font-medium text-[#c9a55a]">
          {t("profile.undertone")}: {undertoneLabel}
        </span>
        <span className="rounded-full bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-400">
          {t("profile.contrast")}: {contrastLabel}
        </span>
      </div>

      {/* Description */}
      <p className="text-center text-sm text-[#f0ece4]/55">{result.description}</p>

      {/* Your colors */}
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#f0ece4]/35">
          {t("profile.yourColors")}
        </h4>
        <div className="grid grid-cols-6 gap-3">
          {palette.map((c) => (
            <ColorCircle key={c.hex} color={c} />
          ))}
        </div>
      </div>

      {/* Avoid colors */}
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#f0ece4]/35">
          {t("profile.avoidColors")}
        </h4>
        <div className="grid grid-cols-6 gap-3">
          {avoid.map((c) => (
            <ColorCircle key={c.hex} color={c} crossed />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Main page ---------- */

export function ProfilePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [analysisResult, setAnalysisResult] = useState<ColorAnalysisResult | null>(null);

  // Fetch profile
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["profile"],
    queryFn: profileApi.getProfile,
  });

  // Color analysis mutation
  const colorMutation = useMutation({
    mutationFn: (image: string) => profileApi.analyzeColor(image),
    onSuccess: (data) => {
      setAnalysisResult(data);
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  // Gender mode mutation
  const genderMutation = useMutation({
    mutationFn: (genderMode: string) => profileApi.updateProfile({ genderMode }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const genderOptions = [
    { value: "neutral", label: t("profile.neutral") },
    { value: "male", label: t("profile.male") },
    { value: "female", label: t("profile.female") },
  ] as const;

  // Handle selfie capture via file input
  const handleFileCapture = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "user";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        colorMutation.mutate(base64);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [colorMutation]);

  // Determine what color data to show: fresh result or saved profile
  const displayPalette = analysisResult?.palette ?? (profile?.colorPalette as ColorPaletteEntry[] | null);
  const displayAvoid = analysisResult?.avoid ?? (profile?.avoidColors as ColorPaletteEntry[] | null);
  const displaySeason = analysisResult?.season ?? profile?.colorSeason;

  const hasColorData = displaySeason && displayPalette && displayAvoid;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* User info */}
      <div className="mb-8 flex items-center gap-4">
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name ?? "avatar"}
            className="h-16 w-16 rounded-full object-cover ring-2 ring-[#c9a55a] ring-offset-2 ring-offset-[#0f0f1a]"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#c9a55a]/15 text-2xl font-bold text-[#c9a55a] ring-2 ring-[#c9a55a] ring-offset-2 ring-offset-[#0f0f1a]">
            {(user?.name ?? user?.email ?? "U").charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="font-display text-xl font-semibold text-[#f0ece4]">
            {user?.name ?? user?.email}
          </h1>
          <p className="text-sm text-[#f0ece4]/45">{user?.email}</p>
        </div>
      </div>

      {/* Gender mode selector */}
      <div className="mb-8 rounded-2xl border border-white/[0.06] bg-[#1a1a2e] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[#f0ece4]">
          {t("profile.styleMode")}
        </h2>
        <div className="flex gap-2">
          {genderOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => genderMutation.mutate(opt.value)}
              disabled={genderMutation.isPending}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                (profile?.genderMode ?? "neutral") === opt.value
                  ? "bg-[#c9a55a] text-[#0f0f1a]"
                  : "bg-white/[0.06] text-[#f0ece4]/55 hover:bg-white/[0.1]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Color analysis section */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a2e] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[#f0ece4]">
          {t("profile.determineColorType")}
        </h2>

        {/* Loading state */}
        {colorMutation.isPending && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#c9a55a] border-t-transparent" />
            <p className="text-sm text-[#f0ece4]/45">
              {t("profile.analyzing")}
            </p>
          </div>
        )}

        {/* Error state */}
        {colorMutation.isError && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {colorMutation.error instanceof Error
              ? colorMutation.error.message
              : t("profile.analysisError")}
          </div>
        )}

        {/* No data yet - show capture button */}
        {!colorMutation.isPending && !hasColorData && (
          <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-[#c9a55a]/20 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#c9a55a]/10">
              <span className="text-3xl">🧑‍🎨</span>
            </div>
            <p className="text-sm text-[#f0ece4]/45">
              {t("profile.selfiePrompt")}
            </p>
            <button
              type="button"
              onClick={handleFileCapture}
              className="gold-btn px-6 py-2.5 text-sm"
            >
              {t("profile.takeSelfie")}
            </button>
          </div>
        )}

        {/* Color result display */}
        {!colorMutation.isPending && hasColorData && displayPalette && displayAvoid && (
          <div className="space-y-6">
            <ColorResultDisplay
              result={{
                season: displaySeason!,
                undertone: analysisResult?.undertone ?? "neutral",
                contrast: analysisResult?.contrast ?? "medium",
                description: analysisResult?.description ?? "",
              }}
              palette={displayPalette}
              avoid={displayAvoid}
            />

            <div className="pt-4">
              <button
                type="button"
                onClick={handleFileCapture}
                className="gold-ghost-btn w-full px-6 py-3 text-base"
              >
                {t("profile.repeatAnalysis")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
