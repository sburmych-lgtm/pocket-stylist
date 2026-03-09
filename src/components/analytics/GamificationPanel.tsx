import { useI18n } from "../../i18n";

interface Challenge {
  id: string;
  name: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  icon: string;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  earned: boolean;
  icon: string;
}

interface GamificationData {
  points: number;
  level: number;
  levelName: string;
  challenges: Challenge[];
  badges: Badge[];
  streaks: { currentDays: number; bestDays: number };
}

interface GamificationPanelProps {
  data: GamificationData;
}

const BADGE_ICONS: Record<string, string> = {
  star: "★",
  crown: "♛",
  leaf: "✿",
  medal: "◉",
  trophy: "✦",
};

export function GamificationPanel({ data }: GamificationPanelProps) {
  const { t } = useI18n();
  const currentLevelProgress = data.points % 100;

  return (
    <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <div className="luxe-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-subtitle">{t("analytics.xpKicker")}</p>
            <h3 className="section-title mt-2">{data.levelName}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              {t("analytics.levelDesc", { level: data.level, points: data.points })}
            </p>
          </div>
          <div className="spotlight-ring flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(201,165,90,0.12)] text-2xl font-semibold text-[var(--accent)]">
            {data.level}
          </div>
        </div>

        <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[rgba(201,165,90,0.62)] to-[var(--accent)]"
            style={{ width: `${currentLevelProgress}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          {t("analytics.toNextLevel", { progress: currentLevelProgress })}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.03] p-4">
            <p className="section-subtitle">{t("analytics.currentStreak")}</p>
            <p className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">
              {t("analytics.days", { count: data.streaks.currentDays })}
            </p>
          </div>
          <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.03] p-4">
            <p className="section-subtitle">{t("analytics.bestStreak")}</p>
            <p className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">
              {t("analytics.days", { count: data.streaks.bestDays })}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="luxe-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-subtitle">{t("analytics.challengesKicker")}</p>
              <h3 className="section-title mt-2">{t("analytics.challengesTitle")}</h3>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {data.challenges.map((challenge) => (
              <div key={challenge.id} className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-[var(--text-primary)]">{challenge.name}</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                      {challenge.description}
                    </p>
                  </div>
                  <span
                    className={[
                      "status-chip",
                      challenge.completed
                        ? "bg-[rgba(111,212,171,0.12)] text-[var(--success)]"
                        : "bg-white/[0.05] text-[var(--text-secondary)]",
                    ].join(" ")}
                  >
                    {challenge.completed
                      ? t("analytics.challengeDone")
                      : `${Math.round((challenge.progress / Math.max(challenge.target, 1)) * 100)}%`}
                  </span>
                </div>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[rgba(136,198,189,0.62)] to-[var(--accent-cool)]"
                    style={{ width: `${Math.min((challenge.progress / Math.max(challenge.target, 1)) * 100, 100)}%` }}
                  />
                </div>
                <p className="mt-3 text-sm text-[var(--text-secondary)]">
                  {challenge.progress}/{challenge.target}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="luxe-card p-6">
          <p className="section-subtitle">{t("analytics.badgesKicker")}</p>
          <h3 className="section-title mt-2">{t("analytics.badgesTitle")}</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.badges.map((badge) => (
              <div
                key={badge.id}
                className={[
                  "rounded-[1.2rem] border p-4 text-center",
                  badge.earned
                    ? "border-[rgba(201,165,90,0.24)] bg-[rgba(201,165,90,0.08)]"
                    : "border-white/8 bg-white/[0.03] opacity-55",
                ].join(" ")}
                title={badge.description}
              >
                <div className="text-2xl">{BADGE_ICONS[badge.icon] ?? "★"}</div>
                <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">{badge.name}</p>
                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                  {badge.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
