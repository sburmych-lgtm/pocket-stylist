interface SharePreviewProps {
  referenceImageUrl: string;
  recreationItems: Array<{ imageUrl: string; category: string }>;
  matchScore: number;
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-400 border-green-400";
  if (score >= 40) return "text-amber-400 border-amber-400";
  return "text-red-400 border-red-400";
}

function scoreTagline(score: number): string {
  if (score >= 80) return "Almost identical!";
  if (score >= 60) return "Great recreation!";
  if (score >= 40) return "Nice effort!";
  return "Creative interpretation!";
}

/**
 * A styled-div preview (not canvas) of what the share card will look like,
 * rendered at ~270x480 in a phone-shaped frame.
 */
export function SharePreview({
  referenceImageUrl,
  recreationItems,
  matchScore,
}: SharePreviewProps) {
  return (
    <div className="mx-auto w-[270px]">
      {/* Phone frame */}
      <div
        className="overflow-hidden rounded-[24px] border-2 border-neutral-700 shadow-xl"
        style={{ aspectRatio: "9/16" }}
      >
        {/* Inner content — gradient background */}
        <div
          className="flex h-full flex-col items-center px-3 py-4"
          style={{
            background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
          }}
        >
          {/* Title */}
          <p className="text-[11px] font-bold tracking-[0.2em] text-slate-300">
            STYLE MATCH
          </p>
          <div className="mx-auto mt-1 h-px w-20 bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />

          {/* Images row */}
          <div className="mt-3 flex w-full items-start justify-center gap-2">
            {/* Reference */}
            <div className="flex flex-col items-center gap-1">
              <p className="text-[8px] font-semibold tracking-wider text-slate-400">
                REFERENCE
              </p>
              <div className="h-[100px] w-[80px] overflow-hidden rounded-lg border border-indigo-500/30">
                <img
                  src={referenceImageUrl}
                  alt="Reference"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            {/* VS badge */}
            <div className="mt-10 flex h-6 w-8 items-center justify-center rounded-full bg-indigo-500 shadow-md shadow-indigo-500/40">
              <span className="text-[8px] font-bold text-white">VS</span>
            </div>

            {/* Recreation grid */}
            <div className="flex flex-col items-center gap-1">
              <p className="text-[8px] font-semibold tracking-wider text-slate-400">
                YOUR LOOK
              </p>
              <div className="grid grid-cols-2 gap-1">
                {recreationItems.slice(0, 4).map((item, i) => (
                  <div
                    key={i}
                    className="h-[48px] w-[38px] overflow-hidden rounded bg-white/10"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.category}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Match score */}
          <div className="mt-3 flex flex-col items-center">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full border-2 bg-black/40 ${scoreColor(matchScore)}`}
            >
              <span className="text-lg font-bold">{matchScore}%</span>
            </div>
            <p className="mt-0.5 text-[8px] text-slate-400">MATCH</p>
          </div>

          {/* Tagline */}
          <p className="mt-1.5 text-center text-[9px] italic text-slate-300">
            {scoreTagline(matchScore)}
          </p>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Watermark */}
          <div className="flex flex-col items-center gap-0.5">
            <div className="h-px w-16 bg-gradient-to-r from-transparent via-slate-500/30 to-transparent" />
            <p className="mt-1 text-[10px] font-bold text-slate-300">
              Pocket Stylist
            </p>
            <p className="text-[8px] text-slate-500">pocket-stylist.app</p>
          </div>
        </div>
      </div>
    </div>
  );
}
