# TTS Setup — Pocket Stylist

Pocket Stylist ships voice playback for AI-authored messages (styling tips, lookbook notes) in two tiers:

| Tier | Quality | Cost | Activates when |
| --- | --- | --- | --- |
| **ElevenLabs (server)** | Premium, per-persona voices | €5/month for 30k chars (Starter) | `ELEVENLABS_API_KEY` is set |
| **Browser `speechSynthesis`** | OS-native, decent for Ukrainian | Free | Always (no key needed) |

**The browser fallback works immediately — you do not need to sign up for ElevenLabs to ship.**
You only need a key when you want the premium per-persona voices.

---

## 1. Sign up for ElevenLabs (optional, premium tier)

1. Go to <https://elevenlabs.io>.
2. Click **Sign up**. The free tier gives you ~10k chars/month — enough for testing.
3. Upgrade to **Starter (€5/mo)** when you're ready to ship: that's ~30k chars/mo, which is plenty for a small user base. Pocket Stylist's typical message (a styling tip) is 80–150 characters.
4. Visit <https://elevenlabs.io/app/settings/api-keys>.
5. Click **Create new key**. Copy it once — it's only shown to you on creation.

## 2. Add the key to Railway

> **DO NOT** use Railway's **Raw Editor** — it can wipe other env vars on save.
> Use the **+ New Variable** button at the top of the Variables panel.

1. Open the Pocket Stylist project on Railway.
2. Go to your service → **Variables**.
3. Click **+ New Variable**.
4. Name: `ELEVENLABS_API_KEY` Value: the key from step 1.5.
5. Click **Add**. Railway will redeploy automatically.

After the deploy is live, `/api/status` will report `"ttsConfigured": true`. The 🔊 button will switch from browser TTS to ElevenLabs without any client changes.

## 3. (Optional) Override per-persona voices

Each of the four stylist personas — `classic`, `sassy`, `manly`, `kind` — uses a sensible default voice from ElevenLabs' built-in library:

| Persona | Default voice ID | Voice name |
| --- | --- | --- |
| `classic` | `21m00Tcm4TlvDq8ikWAM` | Rachel |
| `sassy` | `AZnzlk1XvdvUeBnXmlld` | Domi |
| `manly` | `ErXwobaYiN019PkySvjV` | Antoni |
| `kind` | `EXAVITQu4vr4xnSDxMaL` | Bella |

To swap any of them for a custom-cloned voice, add the corresponding env var:

- `ELEVENLABS_VOICE_CLASSIC`
- `ELEVENLABS_VOICE_SASSY`
- `ELEVENLABS_VOICE_MANLY`
- `ELEVENLABS_VOICE_KIND`

Each value is the voice ID copied from the ElevenLabs Voice Library page.

## 4. Limits and guardrails

The server enforces:

- **800 characters per request** — anything longer returns `400 text_too_long`. Styling tips are well under this; truncate or split longer messages on the client.
- **15 requests per 5 minutes per user** — anything more returns `429 rate_limit_exceeded` with a `Retry-After` header. This is intentionally tight: it protects your ElevenLabs quota from runaway clients and abuse.
- Audio responses are cached:
  - In-memory LRU (100 entries) inside each server instance.
  - On Cloudinary as `raw` resources at `pocket-stylist/tts/<hash>` (if Cloudinary is configured). This survives redeploys and is shared across instances.

## 5. Privacy and security

- The API key is never sent to the browser. The client only knows `elevenlabsEnabled: true/false` via `/api/tts/status`.
- Audio buffers are never logged.
- The server never logs the upstream ElevenLabs response body — some 4xx errors include the key.
- All TTS endpoints require auth (`requireAuth`).

## 6. Removing the key

To go back to browser-only TTS, delete the `ELEVENLABS_API_KEY` variable in Railway and redeploy. The 🔊 button keeps working — it just degrades to `speechSynthesis`.
