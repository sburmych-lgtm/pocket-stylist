import { useEffect, useState } from "react";
import { BadgeCheck, Heart, RefreshCcw, Sparkles, Wand2 } from "lucide-react";
import type { WardrobeItem } from "../../types/wardrobe";
import { useI18n } from "../../i18n";
import { getAppStatus } from "../../services/api";
import type { StylistPersona } from "../../services/api";
import { SpeakButton } from "../common/SpeakButton";
import { TryOnModal } from "./TryOnModal";

interface OutfitCardProps {
  name: string;
  items: WardrobeItem[];
  stylingTip: string;
  confidence: number;
  whyItWorks?: string;
  weatherFit?: string;
  risks?: string[];
  persona?: StylistPersona;
  onLike?: () => void;
  onDislike?: () => void;
  onWear?: () => void;
}

export function OutfitCard({
  name,
  items,
  stylingTip,
  confidence,
  whyItWorks,
  weatherFit,
  risks = [],
  persona = "classic",
  onLike,
  onDislike,
  onWear,
}: OutfitCardProps) {
  const { t } = useI18n();
  const [tryOnAvailable, setTryOnAvailable] = useState(false);
  const [tryOnOpen, setTryOnOpen] = useState(false);
  const [reaction, setReaction] = useState<"liked" | "disliked" | null>(null);
  const [worn, setWorn] = useState(false);

  // Hide the Try-on button until the server reports FAL_KEY is set so we
  // don't ship a CTA that returns 503.
  useEffect(() => {
    getAppStatus()
      .then((s) => setTryOnAvailable(s.tryOnConfigured))
      .catch(() => setTryOnAvailable(false));
  }, []);

  // First image-bearing top is the "headline garment" for the try-on.
  // Falls back to the first item with an http/data image at all.
  const tryOnTarget = items.find(
    (i) =>
      (i.category === "tops" || i.category === "dresses") &&
      (i.imageUrl.startsWith("http") || i.imageUrl.startsWith("data:")),
  ) ?? items.find((i) => i.imageUrl.startsWith("http") || i.imageUrl.startsWith("data:"));

  const confidenceTone =
    confidence >= 0.7
      ? "bg-[rgba(111,212,171,0.12)] text-[var(--success)]"
      : "bg-[rgba(241,195,121,0.12)] text-[var(--warning)]";
  const rationalePoints = [
    whyItWorks,
    weatherFit,
    ...risks.map((risk) => `⚠ ${risk}`),
  ].filter((point): point is string => Boolean(point));
  const displayPoints = rationalePoints.length > 0
    ? rationalePoints
    : [t("outfit.point1"), t("outfit.point2"), t("outfit.point3")];

  return (
    <article className="luxe-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="page-kicker">
            <Sparkles size={14} />
            {t("outfit.kicker")}
          </span>
          <h3 className="mt-4 text-2xl font-semibold text-[var(--text-primary)]">{name}</h3>
        </div>

        <div className="flex items-center gap-2">
          <span className={`status-chip ${confidenceTone}`}>
            <BadgeCheck size={13} />
            {t("outfit.match", { value: Math.round(confidence * 100) })}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-[1.35rem] border border-white/8 bg-white/[0.03]"
            >
              <div className="aspect-[4/5] overflow-hidden">
                {item.imageUrl.startsWith("data:") || item.imageUrl.startsWith("http") ? (
                  <img src={item.imageUrl} alt={item.category} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-[var(--text-muted)]">
                    {item.category}
                  </div>
                )}
              </div>
              <div className="space-y-1 px-4 py-3">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {item.subcategory ?? item.category}
                </p>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {item.colorPrimary}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="section-subtitle">{t("outfit.stylingNote")}</p>
              <SpeakButton text={stylingTip} persona={persona} />
            </div>
            <p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">
              {stylingTip}
            </p>
          </div>

          <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-5">
            <p className="section-subtitle">{t("outfit.whyItWorks")}</p>
            <div className="mt-4 space-y-3">
              {displayPoints.map((point) => (
                <div key={point} className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-[var(--accent)]" />
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">{point}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto flex flex-wrap gap-2">
            {onLike && (
              <button
                type="button"
                onClick={() => {
                  setReaction("liked");
                  onLike();
                }}
                aria-pressed={reaction === "liked"}
                className={`ghost-action inline-flex items-center gap-2 px-4 py-3 text-sm ${reaction === "liked" ? "text-[var(--success)]" : ""}`}
              >
                <Heart size={15} fill={reaction === "liked" ? "currentColor" : "none"} />
                {reaction === "liked" ? t("outfit.liked") : t("outfit.like")}
              </button>
            )}
            {onDislike && (
              <button
                type="button"
                onClick={() => {
                  setReaction("disliked");
                  onDislike();
                }}
                aria-pressed={reaction === "disliked"}
                className="ghost-action inline-flex items-center gap-2 px-4 py-3 text-sm"
              >
                <RefreshCcw size={15} />
                {t("outfit.alternative")}
              </button>
            )}
            {tryOnAvailable && tryOnTarget && (
              <button
                type="button"
                onClick={() => setTryOnOpen(true)}
                className="ghost-action inline-flex items-center gap-2 px-4 py-3 text-sm"
                title={t("tryon.title")}
              >
                <Wand2 size={15} className="text-[var(--accent)]" />
                {t("tryon.cta")}
              </button>
            )}
            {onWear && (
              <button
                type="button"
                disabled={worn}
                onClick={() => {
                  setWorn(true);
                  onWear();
                }}
                className="primary-action inline-flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm disabled:opacity-60 sm:flex-none"
              >
                {worn ? t("outfit.wearLogged") : t("outfit.willWear")}
              </button>
            )}
          </div>
        </div>
      </div>

      {tryOnTarget && tryOnOpen && (
        <TryOnModal
          open={tryOnOpen}
          onClose={() => setTryOnOpen(false)}
          garmentImageUrl={tryOnTarget.imageUrl}
          garmentLabel={tryOnTarget.subcategory ?? tryOnTarget.category}
        />
      )}
    </article>
  );
}
