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
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-500">Level {data.level}</p>
            <h3 className="text-lg font-bold text-neutral-800">
              {data.levelName}
            </h3>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-indigo-600">{data.points}</p>
            <p className="text-xs text-neutral-400">points</p>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-xs text-neutral-400">
            <span>{currentLevelProgress} / 100</span>
            <span>Next level</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-neutral-100">
            <div
              className="h-2 rounded-full bg-indigo-500 transition-all"
              style={{ width: `${currentLevelProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Challenges */}
      <div className="rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 px-5 py-3">
          <h3 className="font-semibold text-neutral-800">Challenges</h3>
        </div>
        <div className="divide-y divide-neutral-100">
          {data.challenges.map((ch) => (
            <div key={ch.id} className="flex items-center gap-3 px-5 py-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                  ch.completed
                    ? "bg-green-100 text-green-600"
                    : "bg-neutral-100 text-neutral-400"
                }`}
              >
                {ch.completed ? "\u2713" : `${Math.round((ch.progress / Math.max(ch.target, 1)) * 100)}%`}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-neutral-700">
                  {ch.name}
                </p>
                <p className="text-xs text-neutral-400">{ch.description}</p>
              </div>
              <span className="text-xs text-neutral-400">
                {ch.progress}/{ch.target}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Badges */}
      <div className="rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 px-5 py-3">
          <h3 className="font-semibold text-neutral-800">Badges</h3>
        </div>
        <div className="flex flex-wrap gap-3 px-5 py-4">
          {data.badges.map((badge) => (
            <div
              key={badge.id}
              className={`flex flex-col items-center rounded-lg border px-3 py-2 text-center ${
                badge.earned
                  ? "border-amber-200 bg-amber-50"
                  : "border-neutral-200 bg-neutral-50 opacity-50"
              }`}
              title={badge.description}
            >
              <span className="text-xl">
                {BADGE_ICONS[badge.icon] ?? "\u2B50"}
              </span>
              <span className="mt-1 text-xs font-medium text-neutral-700">
                {badge.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
