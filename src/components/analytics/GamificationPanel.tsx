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
  star: "\u2B50",
  crown: "\uD83D\uDC51",
  leaf: "\uD83C\uDF3F",
  medal: "\uD83C\uDFC5",
  trophy: "\uD83C\uDFC6",
};

export function GamificationPanel({ data }: GamificationPanelProps) {
  const currentLevelProgress = data.points % 100;

  return (
    <div className="space-y-4">
      {/* Level card */}
      <div className="rounded-xl border border-white/[0.06] bg-[#1a1a2e] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[#f0ece4]/45">Рівень {data.level}</p>
            <h3 className="text-lg font-bold text-[#f0ece4]">{data.levelName}</h3>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[#c9a55a]">{data.points}</p>
            <p className="text-xs text-[#f0ece4]/35">очок</p>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-xs text-[#f0ece4]/35">
            <span>{currentLevelProgress} / 100</span>
            <span>Наступний рівень</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-white/[0.06]">
            <div className="h-2 rounded-full bg-[#c9a55a] transition-all"
              style={{ width: `${currentLevelProgress}%` }} />
          </div>
        </div>
      </div>

      {/* Challenges */}
      <div className="rounded-xl border border-white/[0.06] bg-[#1a1a2e]">
        <div className="border-b border-white/[0.06] px-5 py-3">
          <h3 className="font-semibold text-[#f0ece4]">Виклики</h3>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {data.challenges.map((ch) => (
            <div key={ch.id} className="flex items-center gap-3 px-5 py-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                ch.completed ? "bg-emerald-500/10 text-emerald-400" : "bg-white/[0.05] text-[#f0ece4]/35"
              }`}>
                {ch.completed ? "\u2713" : `${Math.round((ch.progress / Math.max(ch.target, 1)) * 100)}%`}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#f0ece4]/80">{ch.name}</p>
                <p className="text-xs text-[#f0ece4]/35">{ch.description}</p>
              </div>
              <span className="text-xs text-[#f0ece4]/35">{ch.progress}/{ch.target}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Badges */}
      <div className="rounded-xl border border-white/[0.06] bg-[#1a1a2e]">
        <div className="border-b border-white/[0.06] px-5 py-3">
          <h3 className="font-semibold text-[#f0ece4]">Бейджі</h3>
        </div>
        <div className="flex flex-wrap gap-3 px-5 py-4">
          {data.badges.map((badge) => (
            <div key={badge.id}
              className={`flex flex-col items-center rounded-lg border px-3 py-2 text-center ${
                badge.earned
                  ? "border-[#c9a55a]/30 bg-[#c9a55a]/10"
                  : "border-white/[0.06] bg-white/[0.03] opacity-50"
              }`}
              title={badge.description}>
              <span className="text-xl">{BADGE_ICONS[badge.icon] ?? "\u2B50"}</span>
              <span className="mt-1 text-xs font-medium text-[#f0ece4]/80">{badge.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
