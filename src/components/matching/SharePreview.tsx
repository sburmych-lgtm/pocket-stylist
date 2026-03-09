import { useI18n } from "../../i18n";

interface SharePreviewProps {
  referenceImageUrl: string;
  recreationItems: Array<{ imageUrl: string; category: string }>;
  matchScore: number;
}

function scoreColor(score: number): string {
  if (score >= 70) {
    return "text-[var(--success)] border-[rgba(111,212,171,0.35)]";
  }
  if (score >= 40) {
    return "text-[var(--accent)] border-[rgba(201,165,90,0.35)]";
  }
  return "text-[var(--danger)] border-[rgba(239,138,128,0.35)]";
}

function scoreTagline(score: number): string {
  if (score >= 80) {
    return "Runway-close recreation";
  }
  if (score >= 60) {
    return "Strong fashion alignment";
  }
  if (score >= 40) {
    return "Promising interpretation";
  }
  return "Experimental wardrobe remix";
}

export function SharePreview({
  referenceImageUrl,
  recreationItems,
  matchScore,
}: SharePreviewProps) {
  const { t } = useI18n();

  return (
    <div className="mx-auto w-full max-w-[20rem]">
      <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,#090b11_0%,#111623_45%,#090b11_100%)] p-4 shadow-[0_28px_70px_rgba(0,0,0,0.42)]">
        <div className="rounded-[1.6rem] border border-white/8 bg-black/15 p-4">
          <div className="text-center">
            <p className="section-subtitle">Pocket Stylist</p>
            <p className="font-display mt-2 text-[2rem] leading-none text-[var(--text-primary)]">
              Celebrity Match
            </p>
            <div className="mx-auto mt-3 h-px w-24 bg-gradient-to-r from-transparent via-[rgba(201,165,90,0.6)] to-transparent" />
          </div>

          <div className="mt-5 grid grid-cols-[0.92fr_auto_1.08fr] items-start gap-3">
            <div className="space-y-2">
              <p className="section-subtitle text-center">{t("matching.reference")}</p>
              <div className="overflow-hidden rounded-[1.2rem] border border-[rgba(201,165,90,0.24)]">
                <img src={referenceImageUrl} alt="Reference" className="aspect-[4/5] h-full w-full object-cover" />
              </div>
            </div>

            <div className="pt-12">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(201,165,90,0.18)] text-xs font-bold text-[var(--accent)]">
                VS
              </div>
            </div>

            <div className="space-y-2">
              <p className="section-subtitle text-center">{t("matching.yourLook")}</p>
              <div className="grid grid-cols-2 gap-2">
                {recreationItems.slice(0, 4).map((item, index) => (
                  <div key={`${item.category}-${index}`} className="overflow-hidden rounded-[0.95rem] border border-white/8 bg-white/[0.03]">
                    <img src={item.imageUrl} alt={item.category} className="aspect-square h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center">
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-full border bg-black/25 ${scoreColor(matchScore)}`}
            >
              <span className="text-2xl font-semibold">{matchScore}%</span>
            </div>
            <p className="mt-3 text-center text-sm leading-6 text-[var(--text-secondary)]">
              {scoreTagline(matchScore)}
            </p>
          </div>

          <div className="mt-6 text-center">
            <p className="font-display text-[1.3rem] text-[var(--accent)]">Digital Atelier</p>
            <p className="mt-1 text-[0.72rem] uppercase tracking-[0.22em] text-[var(--text-muted)]">
              pocket-stylist.app
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
