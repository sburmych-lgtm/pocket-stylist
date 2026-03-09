import { useCallback, useEffect, useRef, useState } from "react";

export interface ShareCardProps {
  referenceImageUrl: string;
  recreationItems: Array<{ imageUrl: string; category: string }>;
  matchScore: number;
  onShare: (blob: Blob) => void;
}

const CANVAS_W = 1080;
const CANVAS_H = 1920;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 0,
): void {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const rectRatio = w / h;

  let sx: number;
  let sy: number;
  let sw: number;
  let sh: number;

  if (imgRatio > rectRatio) {
    sh = img.naturalHeight;
    sw = sh * rectRatio;
    sx = (img.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    sw = img.naturalWidth;
    sh = sw / rectRatio;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }

  ctx.save();
  if (radius > 0) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.clip();
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}

function strokeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  color: string,
  width: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.stroke();
}

function scoreColor(score: number): string {
  if (score >= 70) {
    return "#6fd4ab";
  }
  if (score >= 40) {
    return "#d6b16f";
  }
  return "#ef8a80";
}

function tagline(score: number): string {
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

async function renderCanvas(canvas: HTMLCanvasElement, props: ShareCardProps): Promise<Blob> {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get 2d context");
  }

  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  const background = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  background.addColorStop(0, "#05060a");
  background.addColorStop(0.52, "#10131b");
  background.addColorStop(1, "#05060a");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#d6b16f";
  ctx.beginPath();
  ctx.arc(860, 230, 250, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#88c6bd";
  ctx.beginPath();
  ctx.arc(170, 1660, 210, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#d6b16f";
  ctx.font = "700 30px Manrope, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("POCKET STYLIST", CANVAS_W / 2, 110);

  ctx.fillStyle = "#f7f2eb";
  ctx.font = "600 66px 'Cormorant Garamond', Georgia, serif";
  ctx.fillText("Celebrity Match", CANVAS_W / 2, 190);

  const headerLine = ctx.createLinearGradient(280, 0, 800, 0);
  headerLine.addColorStop(0, "transparent");
  headerLine.addColorStop(0.5, "rgba(214,177,111,0.7)");
  headerLine.addColorStop(1, "transparent");
  ctx.strokeStyle = headerLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(280, 222);
  ctx.lineTo(800, 222);
  ctx.stroke();

  fillRoundRect(ctx, 64, 286, 952, 1230, 52, "rgba(11,14,21,0.7)");
  strokeRoundRect(ctx, 64, 286, 952, 1230, 52, "rgba(247,242,235,0.08)", 2);

  const [referenceImg, ...itemImages] = await Promise.all([
    loadImage(props.referenceImageUrl),
    ...props.recreationItems.map((item) => loadImage(item.imageUrl)),
  ]);

  ctx.fillStyle = "rgba(247,242,235,0.52)";
  ctx.font = "700 22px Manrope, sans-serif";
  ctx.fillText("REFERENCE", 290, 346);
  ctx.fillText("YOUR LOOK", 790, 346);

  drawCover(ctx, referenceImg, 110, 382, 360, 520, 36);
  strokeRoundRect(ctx, 110, 382, 360, 520, 36, "rgba(214,177,111,0.32)", 4);

  fillRoundRect(ctx, 487, 584, 106, 64, 32, "rgba(214,177,111,0.18)");
  strokeRoundRect(ctx, 487, 584, 106, 64, 32, "rgba(214,177,111,0.52)", 2);
  ctx.fillStyle = "#d6b16f";
  ctx.font = "700 28px Manrope, sans-serif";
  ctx.fillText("VS", 540, 627);

  const tileX = 642;
  const tileY = 382;
  const tileSize = 150;
  const tileGap = 18;

  itemImages.slice(0, 6).forEach((img, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = tileX + col * (tileSize + tileGap);
    const y = tileY + row * (tileSize + 84);

    fillRoundRect(ctx, x, y, tileSize, tileSize, 28, "rgba(255,255,255,0.04)");
    drawCover(ctx, img, x, y, tileSize, tileSize, 24);
    strokeRoundRect(ctx, x, y, tileSize, tileSize, 24, "rgba(247,242,235,0.08)", 2);

    ctx.fillStyle = "#f7f2eb";
    ctx.globalAlpha = 0.72;
    ctx.font = "600 18px Manrope, sans-serif";
    ctx.fillText(
      props.recreationItems[index]?.category.toUpperCase() ?? "ITEM",
      x + tileSize / 2,
      y + tileSize + 34,
    );
    ctx.globalAlpha = 1;
  });

  fillRoundRect(ctx, 166, 1000, 748, 220, 40, "rgba(255,255,255,0.03)");
  strokeRoundRect(ctx, 166, 1000, 748, 220, 40, "rgba(247,242,235,0.08)", 2);

  ctx.fillStyle = "rgba(247,242,235,0.5)";
  ctx.font = "700 20px Manrope, sans-serif";
  ctx.fillText("MATCH SCORE", CANVAS_W / 2, 1048);

  const ringColor = scoreColor(props.matchScore);
  ctx.save();
  ctx.shadowColor = ringColor;
  ctx.shadowBlur = 38;
  strokeRoundRect(ctx, 424, 1084, 232, 92, 46, ringColor, 3);
  ctx.restore();
  fillRoundRect(ctx, 438, 1098, 204, 64, 32, "rgba(0,0,0,0.24)");
  ctx.fillStyle = "#f7f2eb";
  ctx.font = "700 58px Manrope, sans-serif";
  ctx.fillText(`${props.matchScore}%`, CANVAS_W / 2, 1148);

  ctx.font = "500 28px Manrope, sans-serif";
  ctx.fillStyle = "#f7f2eb";
  ctx.globalAlpha = 0.76;
  ctx.fillText(tagline(props.matchScore), CANVAS_W / 2, 1260);
  ctx.globalAlpha = 1;

  fillRoundRect(ctx, 140, 1336, 800, 112, 32, "rgba(255,255,255,0.03)");
  strokeRoundRect(ctx, 140, 1336, 800, 112, 32, "rgba(247,242,235,0.08)", 2);
  ctx.fillStyle = "#f7f2eb";
  ctx.font = "500 24px Manrope, sans-serif";
  ctx.fillText(
    "Recreated from your own wardrobe, not from shopping pressure.",
    CANVAS_W / 2,
    1405,
  );

  ctx.fillStyle = "#d6b16f";
  ctx.font = "600 48px 'Cormorant Garamond', Georgia, serif";
  ctx.fillText("Digital Atelier", CANVAS_W / 2, 1720);
  ctx.fillStyle = "rgba(247,242,235,0.42)";
  ctx.font = "700 18px Manrope, sans-serif";
  ctx.fillText("pocket-stylist.app", CANVAS_W / 2, 1764);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/png",
    );
  });
}

export function ShareCard({ referenceImageUrl, recreationItems, matchScore, onShare }: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || rendering) {
      return;
    }

    setRendering(true);
    setError(null);

    try {
      const blob = await renderCanvas(canvas, {
        referenceImageUrl,
        recreationItems,
        matchScore,
        onShare,
      });
      onShare(blob);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRendering(false);
    }
  }, [referenceImageUrl, recreationItems, matchScore, onShare, rendering]);

  useEffect(() => {
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      {rendering && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          <span>Генерую editorial poster...</span>
        </div>
      )}
      {error && <p className="text-sm text-[var(--danger)]">Помилка генерації: {error}</p>}
    </>
  );
}
