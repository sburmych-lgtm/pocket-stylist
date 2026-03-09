import { useCallback, useEffect, useRef, useState } from "react";

export interface ShareCardProps {
  referenceImageUrl: string;
  recreationItems: Array<{ imageUrl: string; category: string }>;
  matchScore: number;
  onShare: (blob: Blob) => void;
}

const CANVAS_W = 1080;
const CANVAS_H = 1920;

/** Loads an image with crossOrigin for Cloudinary URLs. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/** Draws an image covering the target rect (like CSS object-fit: cover). */
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

  let sx: number, sy: number, sw: number, sh: number;
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

/** Draws a rounded rectangle with fill. */
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

async function renderCanvas(
  canvas: HTMLCanvasElement,
  props: ShareCardProps,
): Promise<Blob> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d context");

  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  // --- Background gradient ---
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, "#0f0f1a");
  grad.addColorStop(0.5, "#1a1a2e");
  grad.addColorStop(1, "#0f0f1a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // --- Decorative subtle circles ---
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = "#c9a55a";
  ctx.beginPath();
  ctx.arc(900, 200, 300, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(180, 1600, 250, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // --- Title "STYLE MATCH" ---
  ctx.fillStyle = "#f0ece4";
  ctx.font = "bold 36px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("STYLE MATCH", CANVAS_W / 2, 100);

  // --- Decorative line under title ---
  const lineGrad = ctx.createLinearGradient(340, 0, 740, 0);
  lineGrad.addColorStop(0, "transparent");
  lineGrad.addColorStop(0.3, "#c9a55a");
  lineGrad.addColorStop(0.7, "#dbb978");
  lineGrad.addColorStop(1, "transparent");
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(340, 120);
  ctx.lineTo(740, 120);
  ctx.stroke();

  // --- Load all images ---
  const imagePromises = [
    loadImage(props.referenceImageUrl),
    ...props.recreationItems.map((item) => loadImage(item.imageUrl)),
  ];
  const [referenceImg, ...itemImages] = await Promise.all(imagePromises);

  // --- Reference image (left) ---
  const refX = 60;
  const refY = 170;
  const refW = 440;
  const refH = 620;

  // Label above reference
  ctx.fillStyle = "#f0ece4";
  ctx.globalAlpha = 0.45;
  ctx.font = "600 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("REFERENCE", refX + refW / 2, refY - 15);
  ctx.globalAlpha = 1;

  // Reference image with rounded corners
  fillRoundRect(ctx, refX - 4, refY - 4, refW + 8, refH + 8, 20, "rgba(201,165,90,0.3)");
  drawCover(ctx, referenceImg, refX, refY, refW, refH, 16);

  // --- VS badge ---
  const vsX = CANVAS_W / 2;
  const vsY = refY + refH / 2;
  ctx.save();
  ctx.shadowColor = "rgba(201,165,90,0.5)";
  ctx.shadowBlur = 20;
  fillRoundRect(ctx, vsX - 40, vsY - 30, 80, 60, 30, "#c9a55a");
  ctx.restore();
  ctx.fillStyle = "#0f0f1a";
  ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("VS", vsX, vsY);
  ctx.textBaseline = "alphabetic";

  // --- Recreation items (right side grid) ---
  const gridX = 580;
  const gridY = 170;
  const gridItemSize = 200;
  const gridGap = 16;
  const cols = 2;

  // Label above grid
  ctx.fillStyle = "#f0ece4";
  ctx.globalAlpha = 0.45;
  ctx.font = "600 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("YOUR LOOK", gridX + (cols * gridItemSize + (cols - 1) * gridGap) / 2, gridY - 15);
  ctx.globalAlpha = 1;

  itemImages.forEach((img, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gridX + col * (gridItemSize + gridGap);
    const y = gridY + row * (gridItemSize + gridGap + 40);

    // Card background
    fillRoundRect(ctx, x - 4, y - 4, gridItemSize + 8, gridItemSize + 8, 16, "rgba(255,255,255,0.06)");
    drawCover(ctx, img, x, y, gridItemSize, gridItemSize, 12);

    // Category label below
    const item = props.recreationItems[i];
    if (item) {
      ctx.fillStyle = "#f0ece4";
      ctx.globalAlpha = 0.55;
      ctx.font = "500 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        item.category.charAt(0).toUpperCase() + item.category.slice(1),
        x + gridItemSize / 2,
        y + gridItemSize + 26,
      );
      ctx.globalAlpha = 1;
    }
  });

  // --- Match score circle ---
  const scoreY = 950;
  const scoreRadius = 100;

  // Glow
  ctx.save();
  ctx.shadowColor = scoreColor(props.matchScore);
  ctx.shadowBlur = 40;

  // Outer ring
  ctx.beginPath();
  ctx.arc(CANVAS_W / 2, scoreY, scoreRadius + 6, 0, Math.PI * 2);
  ctx.strokeStyle = scoreColor(props.matchScore);
  ctx.lineWidth = 4;
  ctx.stroke();

  // Background circle
  ctx.beginPath();
  ctx.arc(CANVAS_W / 2, scoreY, scoreRadius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fill();
  ctx.restore();

  // Progress arc
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (Math.PI * 2 * props.matchScore) / 100;
  ctx.beginPath();
  ctx.arc(CANVAS_W / 2, scoreY, scoreRadius + 6, startAngle, endAngle);
  ctx.strokeStyle = scoreColor(props.matchScore);
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.stroke();

  // Score text
  ctx.fillStyle = "#f0ece4";
  ctx.font = "bold 64px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${props.matchScore}%`, CANVAS_W / 2, scoreY - 6);

  ctx.font = "500 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillStyle = "#f0ece4";
  ctx.globalAlpha = 0.45;
  ctx.fillText("MATCH", CANVAS_W / 2, scoreY + 36);
  ctx.globalAlpha = 1;
  ctx.textBaseline = "alphabetic";

  // --- Fun text based on score ---
  const tagline = getScoreTagline(props.matchScore);
  ctx.fillStyle = "#f0ece4";
  ctx.font = "italic 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(tagline, CANVAS_W / 2, scoreY + scoreRadius + 60);

  // --- Bottom watermark ---
  const wmY = CANVAS_H - 120;

  // Separator line
  const wmLineGrad = ctx.createLinearGradient(200, 0, 880, 0);
  wmLineGrad.addColorStop(0, "transparent");
  wmLineGrad.addColorStop(0.3, "rgba(201,165,90,0.3)");
  wmLineGrad.addColorStop(0.7, "rgba(201,165,90,0.3)");
  wmLineGrad.addColorStop(1, "transparent");
  ctx.strokeStyle = wmLineGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(200, wmY - 40);
  ctx.lineTo(880, wmY - 40);
  ctx.stroke();

  ctx.fillStyle = "#c9a55a";
  ctx.font = "bold 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Pocket Stylist", CANVAS_W / 2, wmY);

  ctx.fillStyle = "#f0ece4";
  ctx.globalAlpha = 0.35;
  ctx.font = "400 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("pocket-stylist.app", CANVAS_W / 2, wmY + 38);
  ctx.globalAlpha = 1;

  // --- Generate blob ---
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/png",
    );
  });
}

function scoreColor(score: number): string {
  if (score >= 70) return "#22c55e";
  if (score >= 40) return "#c9a55a";
  return "#ef4444";
}

function getScoreTagline(score: number): string {
  if (score >= 80) return '"Almost identical!"';
  if (score >= 60) return '"Great recreation!"';
  if (score >= 40) return '"Nice effort!"';
  return '"Creative interpretation!"';
}

export function ShareCard({ referenceImageUrl, recreationItems, matchScore, onShare }: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || rendering) return;

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

  // Auto-generate on mount
  useEffect(() => {
    void generate();
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="hidden"
        aria-hidden="true"
      />
      {rendering && (
        <div className="flex items-center gap-2 text-sm text-[#f0ece4]/45">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#c9a55a] border-t-transparent" />
          <span>Генерую зображення...</span>
        </div>
      )}
      {error && (
        <p className="text-sm text-red-400">
          Помилка генерації: {error}
        </p>
      )}
    </>
  );
}
