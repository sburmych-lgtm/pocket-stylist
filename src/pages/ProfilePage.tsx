import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { profileApi } from "../services/api";
import type {
  ColorAnalysisResult,
  ColorPaletteEntry,
  UserProfile,
} from "../services/api";

/* ---------- Season display map ---------- */

const SEASON_EMOJI: Record<string, string> = {
  "Bright Spring": "\uD83C\uDF3B",
  "True Spring": "\uD83C\uDF37",
  "Light Spring": "\uD83C\uDF38",
  "Light Summer": "\u2600\uFE0F",
  "True Summer": "\uD83C\uDF0A",
  "Soft Summer": "\uD83C\uDF2B\uFE0F",
  "Soft Autumn": "\uD83C\uDF42",
  "True Autumn": "\uD83C\uDF41",
  "Deep Autumn": "\uD83C\uDF3E",
  "Deep Winter": "\u2744\uFE0F",
  "True Winter": "\uD83C\uDF28\uFE0F",
  "Bright Winter": "\u2728",
};

const SEASON_UA: Record<string, string> = {
  "Bright Spring": "\u042F\u0441\u043A\u0440\u0430\u0432\u0430 \u0412\u0435\u0441\u043D\u0430",
  "True Spring": "\u0421\u043F\u0440\u0430\u0432\u0436\u043D\u044F \u0412\u0435\u0441\u043D\u0430",
  "Light Spring": "\u0421\u0432\u0456\u0442\u043B\u0430 \u0412\u0435\u0441\u043D\u0430",
  "Light Summer": "\u0421\u0432\u0456\u0442\u043B\u0435 \u041B\u0456\u0442\u043E",
  "True Summer": "\u0421\u043F\u0440\u0430\u0432\u0436\u043D\u0454 \u041B\u0456\u0442\u043E",
  "Soft Summer": "\u041C\u2019\u044F\u043A\u0435 \u041B\u0456\u0442\u043E",
  "Soft Autumn": "\u041C\u2019\u044F\u043A\u0430 \u041E\u0441\u0456\u043D\u044C",
  "True Autumn": "\u0421\u043F\u0440\u0430\u0432\u0436\u043D\u044F \u041E\u0441\u0456\u043D\u044C",
  "Deep Autumn": "\u0413\u043B\u0438\u0431\u043E\u043A\u0430 \u041E\u0441\u0456\u043D\u044C",
  "Deep Winter": "\u0413\u043B\u0438\u0431\u043E\u043A\u0430 \u0417\u0438\u043C\u0430",
  "True Winter": "\u0421\u043F\u0440\u0430\u0432\u0436\u043D\u044F \u0417\u0438\u043C\u0430",
  "Bright Winter": "\u042F\u0441\u043A\u0440\u0430\u0432\u0430 \u0417\u0438\u043C\u0430",
};

const UNDERTONE_UA: Record<string, string> = {
  warm: "\u0442\u0435\u043F\u043B\u0438\u0439",
  cool: "\u0445\u043E\u043B\u043E\u0434\u043D\u0438\u0439",
  neutral: "\u043D\u0435\u0439\u0442\u0440\u0430\u043B\u044C\u043D\u0438\u0439",
};

const CONTRAST_UA: Record<string, string> = {
  high: "\u0432\u0438\u0441\u043E\u043A\u0438\u0439",
  medium: "\u0441\u0435\u0440\u0435\u0434\u043D\u0456\u0439",
  low: "\u043D\u0438\u0437\u044C\u043A\u0438\u0439",
};

const GENDER_OPTIONS = [
  { value: "neutral", label: "\u041D\u0435\u0439\u0442\u0440\u0430\u043B\u044C\u043D\u0438\u0439" },
  { value: "male", label: "\u0427\u043E\u043B\u043E\u0432\u0456\u0447\u0438\u0439" },
  { value: "female", label: "\u0416\u0456\u043D\u043E\u0447\u0438\u0439" },
] as const;

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
          className="h-12 w-12 rounded-full border-2 border-white shadow-md"
          style={{ backgroundColor: color.hex }}
        />
        {crossed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-14 w-0.5 rotate-45 bg-red-500" />
          </div>
        )}
      </div>
      <span className="max-w-16 text-center text-xs leading-tight text-neutral-600">
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
  const emoji = SEASON_EMOJI[result.season] ?? "\uD83C\uDFA8";
  const seasonUa = SEASON_UA[result.season] ?? result.season;

  return (
    <div className="space-y-6">
      {/* Season header */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-neutral-900">
          {emoji} {seasonUa}
        </h3>
        <p className="mt-1 text-sm text-neutral-500">{result.season}</p>
      </div>

      {/* Badges */}
      <div className="flex justify-center gap-3">
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
          {"\u041F\u0456\u0434\u0442\u043E\u043D: "}{UNDERTONE_UA[result.undertone] ?? result.undertone}
        </span>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
          {"\u041A\u043E\u043D\u0442\u0440\u0430\u0441\u0442: "}{CONTRAST_UA[result.contrast] ?? result.contrast}
        </span>
      </div>

      {/* Description */}
      <p className="text-center text-sm text-neutral-600">{result.description}</p>

      {/* Your colors */}
      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
          {"\u0412\u0430\u0448\u0456 \u043A\u043E\u043B\u044C\u043E\u0440\u0438"}
        </h4>
        <div className="grid grid-cols-6 gap-3">
          {palette.map((c) => (
            <ColorCircle key={c.hex} color={c} />
          ))}
        </div>
      </div>

      {/* Avoid colors */}
      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
          {"\u0423\u043D\u0438\u043A\u0430\u0442\u0438"}
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
            className="h-16 w-16 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-2xl font-bold text-indigo-700">
            {(user?.name ?? user?.email ?? "U").charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-neutral-900">
            {user?.name ?? user?.email}
          </h1>
          <p className="text-sm text-neutral-500">{user?.email}</p>
        </div>
      </div>

      {/* Gender mode selector */}
      <div className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">
          {"\u0420\u0435\u0436\u0438\u043C \u0441\u0442\u0438\u043B\u044E"}
        </h2>
        <div className="flex gap-2">
          {GENDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => genderMutation.mutate(opt.value)}
              disabled={genderMutation.isPending}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                (profile?.genderMode ?? "neutral") === opt.value
                  ? "bg-indigo-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Color analysis section */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">
          {"\u0412\u0438\u0437\u043D\u0430\u0447\u0438\u0442\u0438 \u043A\u043E\u043B\u044C\u043E\u0440\u043E\u0442\u0438\u043F"}
        </h2>

        {/* Loading state */}
        {colorMutation.isPending && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            <p className="text-sm text-neutral-600">
              {"\u0410\u043D\u0430\u043B\u0456\u0437\u0443\u0454\u043C\u043E \u0432\u0430\u0448 \u043A\u043E\u043B\u044C\u043E\u0440\u043E\u0442\u0438\u043F..."}
            </p>
          </div>
        )}

        {/* Error state */}
        {colorMutation.isError && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {colorMutation.error instanceof Error
              ? colorMutation.error.message
              : "\u041F\u043E\u043C\u0438\u043B\u043A\u0430 \u0430\u043D\u0430\u043B\u0456\u0437\u0443"}
          </div>
        )}

        {/* No data yet - show capture button */}
        {!colorMutation.isPending && !hasColorData && (
          <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-neutral-300 py-12">
            <div className="text-5xl">{"\uD83E\uDDD1\u200D\uD83C\uDFA8"}</div>
            <p className="text-sm text-neutral-500">
              {"\u0417\u0440\u043E\u0431\u0456\u0442\u044C \u0441\u0435\u043B\u0444\u0456 \u0434\u043B\u044F \u0432\u0438\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u0432\u0430\u0448\u043E\u0433\u043E \u043A\u043E\u043B\u044C\u043E\u0440\u043E\u0442\u0438\u043F\u0443"}
            </p>
            <button
              type="button"
              onClick={handleFileCapture}
              className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              {"\uD83D\uDCF8 \u0417\u0440\u043E\u0431\u0438\u0442\u0438 \u0441\u0435\u043B\u0444\u0456"}
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
                className="w-full rounded-xl border border-neutral-300 px-6 py-3 text-base font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                {"\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0438 \u0430\u043D\u0430\u043B\u0456\u0437"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
