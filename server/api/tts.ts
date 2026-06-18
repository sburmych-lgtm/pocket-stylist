import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  STYLIST_PERSONAS,
  TEXT_MAX_LENGTH,
  TtsError,
  getTtsStatus,
  isTtsElevenLabsEnabled,
  synthesizeSpeech,
  type StylistPersona,
} from "../services/tts.js";
import { rateLimitPerUser } from "../middleware/rate-limit.js";

export const ttsRouter = Router();

const PersonaEnum = z.enum(STYLIST_PERSONAS as unknown as [StylistPersona, ...StylistPersona[]]);

const TtsRequestSchema = z.object({
  text: z
    .string()
    .min(1)
    .max(TEXT_MAX_LENGTH, { message: `text exceeds ${TEXT_MAX_LENGTH} chars` }),
  persona: PersonaEnum.optional(),
});

// 15 requests / 5 min per user — matches ElevenLabs free-tier-friendly burst.
const ttsLimiter = rateLimitPerUser({
  limit: 15,
  windowMs: 5 * 60 * 1000,
  tag: "tts",
});

ttsRouter.get("/status", (_req: Request, res: Response): void => {
  res.set("Cache-Control", "no-store");
  res.json(getTtsStatus());
});

ttsRouter.post(
  "/",
  ttsLimiter,
  async (req: Request, res: Response): Promise<void> => {
    if (!isTtsElevenLabsEnabled()) {
      res.status(503).json({
        error: "tts_unavailable",
        useBrowserFallback: true,
      });
      return;
    }

    const parsed = TtsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const tooLong = firstIssue?.code === "too_big";
      res.status(400).json({
        error: tooLong ? "text_too_long" : "invalid_payload",
        maxLength: TEXT_MAX_LENGTH,
      });
      return;
    }

    const { text, persona = "classic" } = parsed.data;

    try {
      const { audio, cached } = await synthesizeSpeech({ text, persona });
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", String(audio.byteLength));
      res.setHeader("Cache-Control", "private, max-age=86400");
      res.setHeader("X-TTS-Cache", cached ? "hit" : "miss");
      res.status(200).end(audio);
    } catch (err) {
      if (err instanceof TtsError) {
        if (err.code === "tts_unavailable") {
          res.status(503).json({
            error: "tts_unavailable",
            useBrowserFallback: true,
          });
          return;
        }
        if (err.code === "invalid_input") {
          res
            .status(400)
            .json({ error: "text_too_long", maxLength: TEXT_MAX_LENGTH });
          return;
        }
        if (err.code === "tts_timeout") {
          res.status(504).json({
            error: "tts_timeout",
            useBrowserFallback: true,
          });
          return;
        }
        // Never log the upstream body — it may include the API key.
        console.error("[tts] synthesize failed:", err.message);
        res.status(502).json({
          error: "tts_failed",
          useBrowserFallback: true,
        });
        return;
      }
      console.error("[tts] unexpected error");
      res.status(500).json({
        error: "tts_failed",
        useBrowserFallback: true,
      });
    }
  },
);
