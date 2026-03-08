# Pocket Stylist — Architecture Strategy

## Why this architecture

### Hybrid AI engine (pure code + Gemini)
**Decision**: Split logic into free pure-code operations and paid Gemini API calls.
**Why**: Gemini free tier has 1,500 req/day hard limit. At ~3 requests per user per day, this supports ~500 daily active users for free. Pure-code operations (color matching, filtering, math) handle unlimited load at zero cost.
**Alternative rejected**: Using Gemini for everything — would exhaust budget at ~50 daily users. Unacceptable for a free-tier product.
**Alternative rejected**: Using only pure code (no AI) — loses the core value proposition (photo analysis, creative styling). No competitive differentiation.

### Gemini 2.5 Flash over alternatives
**Decision**: Use Gemini 2.5 Flash free tier exclusively.
**Why**: 1,500 req/day free, fast inference (<3s for text, <5s for images), good at structured JSON output, multimodal (text + images in one call).
**Alternative rejected**: OpenAI GPT-4o — no free tier, $2.50/1M input tokens adds up fast for a free app.
**Alternative rejected**: Claude API — more expensive than Gemini for vision tasks, no free tier.
**Alternative rejected**: Local models (Ollama) — too slow for real-time UX, requires GPU on user device.
**Risk**: Google may change free tier limits. Mitigation: aggressive caching + pure-code fallbacks for all non-critical features.

### PostgreSQL + pgvector over alternatives
**Decision**: PostgreSQL with pgvector extension for clothing embeddings.
**Why**: One database for relational data AND vector similarity search. Eliminates need for separate vector DB (Pinecone, Weaviate). Railway supports PostgreSQL natively.
**Alternative rejected**: SQLite — no vector extension, not suitable for production with concurrent users.
**Alternative rejected**: MongoDB — overkill for this data model, no built-in vector search without Atlas.
**Alternative rejected**: Pinecone + PostgreSQL — two databases = double complexity, double cost.

### Monorepo (frontend + backend) over split
**Decision**: Single repository with React frontend and Express backend.
**Why**: Simplifies deployment (one Railway service), simplifies development (shared types), and this is a solo developer project — no team coordination needed.
**Alternative rejected**: Separate frontend/backend repos — unnecessary complexity for solo development.

### Phase-based build over feature-based
**Decision**: Build in 6 sequential phases, each self-contained and deployable.
**Why**: Each phase produces a working, testable increment. Phase 0 (setup) → Phase 1 (import, the #1 problem) → Phase 2 (core value: styling) → Phase 3-5 (differentiators). Enables early testing and course correction.
**Risk**: Later phases may require changes to earlier phase code. Mitigation: solid TypeScript types and Zod schemas create stable interfaces between phases.

### Codex for UI restyle (post-build)
**Decision**: Claude Code builds all functionality with basic UI, then Codex Desktop restyls.
**Why**: Claude Code excels at logic, architecture, and full-stack integration. Codex Desktop excels at visual design iteration. Splitting the work plays to each tool's strengths. Also avoids polluting Claude Code context with CSS discussions.
**Risk**: Codex may break functionality while restyling. Mitigation: strict rules in restyle-prompt.md — only modify className and layout, never touch handlers or logic. typecheck + build must pass.

## Risk areas
1. **Gemini free tier changes**: If Google reduces limits, app features degrade. Cache aggressively.
2. **Camera API on mobile**: getUserMedia() works differently across browsers. Test on Chrome Android + Safari iOS.
3. **OAuth complexity**: Google Calendar + Gmail OAuth requires verified consent screen for production. Plan for verification process.
4. **pgvector performance**: Cosine similarity search may slow with 10K+ items per user. Monitor and add indexes.
5. **Cloudinary free tier**: 25K transformations/month. With 500 users × 50 items = 25K at onboarding alone. May need paid tier sooner than expected.
