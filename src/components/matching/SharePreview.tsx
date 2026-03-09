interface SharePreviewProps {
  referenceImageUrl: string;
  recreationItems: Array<{ imageUrl: string; category: string }>;
  matchScore: number;
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-400 border-emerald-400";
  if (score >= 40) return "text-[#c9a55a] border-[#c9a55a]";
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
        className="overflow-hidden rounded-[24px] border-2 border-[#c9a55a]/30 shadow-xl shadow-black/30"
        style={{ aspectRatio: "9/16" }}
      >
        {/* Inner content — gradient background */}
        <div
          className="flex h-full flex-col items-center px-3 py-4"
          style={{
            background: "linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%)",
          }}
        >
          {/* Title */}
          <p className="text-[11px] font-bold tracking-[0.2em] text-[#f0ece4]">
            STYLE MATCH
          </p>
          <div className="mx-auto mt-1 h-px w-20 bg-gradient-to-r from-transparent via-[#c9a55a] to-transparent" />

          {/* Images row */}
          <div className="mt-3 flex w-full items-start justify-center gap-2">
            {/* Reference */}
            <div className="flex flex-col items-center gap-1">
              <p className="text-[8px] font-semibold tracking-wider text-[#f0ece4]/45">
                REFERENCE
              </p>
              <div className="h-[100px] w-[80px] overflow-hidden rounded-lg border border-[#c9a55a]/30">
                <img
                  src={referenceImageUrl}
                  alt="Reference"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            {/* VS badge */}
            <div className="mt-10 flex h-6 w-8 items-center justify-center rounded-full bg-[#c9a55a] shadow-md shadow-[#c9a55a]/30">
              <span className="text-[8px] font-bold text-[#0f0f1a]">VS</span>
            </div>

            {/* Recreation grid */}
            <div className="flex flex-col items-center gap-1">
              <p className="text-[8px] font-semibold tracking-wider text-[#f0ece4]/45">
                YOUR LOOK
              </p>
              <div className="grid grid-cols-2 gap-1">
                {recreationItems.slice(0, 4).map((item, i) => (
                  <div
                    key={i}
                    className="h-[48px] w-[38px] overflow-hidden rounded bg-white/[0.06]"
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
            <p className="mt-0.5 text-[8px] text-[#f0ece4]/45">MATCH</p>
          </div>

          {/* Tagline */}
          <p className="mt-1.5 text-center text-[9px] italic text-[#f0ece4]/70">
            {scoreTagline(matchScore)}
          </p>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Watermark */}
          <div className="flex flex-col items-center gap-0.5">
            <div className="h-px w-16 bg-gradient-to-r from-transparent via-[#c9a55a]/30 to-transparent" />
            <p className="mt-1 text-[10px] font-bold text-[#c9a55a]">
              Pocket Stylist
            </p>
            <p className="text-[8px] text-[#f0ece4]/35">pocket-stylist.app</p>
          </div>
        </div>
      </div>
    </div>
  );
}
