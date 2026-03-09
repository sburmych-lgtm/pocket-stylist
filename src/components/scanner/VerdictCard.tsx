import { BadgeCheck, CircleHelp, CircleX, Layers, Sparkles, Wallet } from "lucide-react";

interface VerdictCardProps {
  verdict: "BUY" | "SKIP" | "CONSIDER";
  reasons: string[];
  tags: {
    category: string;
    subcategory: string;
    colorPrimary: string;
    colorHex: string;
    pattern: string;
    fabric: string;
    formalityLevel: number;
    confidence: number;
  };
  stats: {
    sameCategoryCount: number;
    sameColorCount: number;
    newOutfitPotential: number;
    projectedCostPerWear: string;
    avgWearsInWardrobe: number;
  };
}

function verdictMeta(verdict: VerdictCardProps["verdict"]) {
  if (verdict === "BUY") {
    return {
      title: "BUY",
      copy: "Сильне підсилення гардеробу з високим outfit-potential.",
      tone: "border-[rgba(111,212,171,0.28)] bg-[linear-gradient(180deg,rgba(111,212,171,0.12),rgba(13,16,24,0.96))] text-[var(--success)]",
      icon: BadgeCheck,
    };
  }
  if (verdict === "SKIP") {
    return {
      title: "SKIP",
      copy: "Річ не додає достатньо нової цінності до вашої капсули.",
      tone: "border-[rgba(239,138,128,0.28)] bg-[linear-gradient(180deg,rgba(239,138,128,0.12),rgba(13,16,24,0.96))] text-[var(--danger)]",
      icon: CircleX,
    };
  }
  return {
    title: "CONSIDER",
    copy: "Потенціал є, але рішення залежить від стилістичного пріоритету.",
    tone: "border-[rgba(241,195,121,0.28)] bg-[linear-gradient(180deg,rgba(241,195,121,0.12),rgba(13,16,24,0.96))] text-[var(--warning)]",
    icon: CircleHelp,
  };
}

function StatTile({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string;
  Icon: typeof Layers;
}) {
  return (
    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-[var(--text-muted)]">
        <Icon size={15} />
        <p className="section-subtitle">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

export function VerdictCard({ verdict, reasons, tags, stats }: VerdictCardProps) {
  const meta = verdictMeta(verdict);
  const Icon = meta.icon;

  return (
    <article className={`luxe-card p-6 sm:p-7 ${meta.tone}`}>
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="page-kicker">
                <Icon size={14} />
                Scanner Verdict
              </span>
              <h2 className="mt-4 text-[2.6rem] font-semibold leading-none">{meta.title}</h2>
              <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
                {meta.copy}
              </p>
            </div>
            {tags.colorHex && (
              <span
                className="spotlight-ring inline-block h-12 w-12 rounded-full border border-white/10"
                style={{ backgroundColor: tags.colorHex }}
              />
            )}
          </div>

          <div className="rounded-[1.4rem] border border-white/8 bg-black/15 p-4">
            <p className="section-subtitle">Detected Item</p>
            <p className="mt-3 text-xl font-semibold text-[var(--text-primary)]">
              {tags.subcategory ?? tags.category}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              {tags.colorPrimary} · {tags.pattern} · {tags.fabric ?? "unknown fabric"}
            </p>
          </div>

          <div className="space-y-3">
            {reasons.map((reason) => (
              <div
                key={reason}
                className="flex items-start gap-3 rounded-[1.1rem] border border-white/8 bg-white/[0.03] px-4 py-3"
              >
                <span className="mt-2 h-2 w-2 rounded-full bg-current" />
                <p className="text-sm leading-6 text-[var(--text-secondary)]">{reason}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatTile label="Та ж категорія" value={String(stats.sameCategoryCount)} Icon={Layers} />
            <StatTile label="Той самий колір" value={String(stats.sameColorCount)} Icon={Sparkles} />
            <StatTile label="Нові образи" value={`${stats.newOutfitPotential}+`} Icon={BadgeCheck} />
            <StatTile label="Ціна / носіння" value={stats.projectedCostPerWear} Icon={Wallet} />
          </div>

          <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-5">
            <p className="section-subtitle">Scanner Readiness</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-3xl font-semibold text-[var(--text-primary)]">
                  {Math.round(tags.confidence * 100)}%
                </p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">AI confidence</p>
              </div>
              <div>
                <p className="text-3xl font-semibold text-[var(--text-primary)]">
                  {tags.formalityLevel}/5
                </p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">Formality fit</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
              У середньому подібні речі у вашому гардеробі носяться {stats.avgWearsInWardrobe} разів.
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
