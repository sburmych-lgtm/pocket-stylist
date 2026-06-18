---
name: stylist-master-task
description: Master orchestrator for the Pocket Stylist project — runs a full diagnostic and improvement cycle. Use this skill when the user gives a complex multi-part task involving git sync checks, auth debugging, AI analysis, feature implementation, and feasibility studies for the Stylist app. Triggers on "full project check", "run everything", "master task", or when the user provides a large task list covering multiple aspects of the Stylist project. Launches sub-agents in parallel for maximum efficiency.
---

# Stylist Master Task Orchestrator

Execute a full diagnostic and improvement cycle for the Pocket Stylist project. This skill coordinates multiple sub-tasks, running independent work in parallel via sub-agents.

## Project context

- **Location:** G:\Веб-додатки\Stylist
- **Stack:** React 19 + Express + PostgreSQL + Prisma + Gemini 2.5 Flash
- **Deploy:** GitHub → Railway (auto-deploy on push to main)
- **AI:** Gemini 2.5 Flash free tier (1,500 req/day)
- **Images:** Cloudinary
- **Auth:** Google OAuth + JWT (stateless, 7-day expiry)

## Execution plan

Parse the user's task and organize into phases. The standard phases are:

### Phase 1: Diagnostics (parallel sub-agents)

Launch these as parallel sub-agents since they're independent:

**Agent 1: Git Sync Check**
```
Task: Compare local code at G:\Веб-додатки\Stylist with GitHub remote.
Run git fetch, compare commits, check for uncommitted changes, verify .env safety.
Report: sync status, divergence details, recommendations.
Do NOT push or pull — only report.
```

**Agent 2: Auth Diagnostics**
```
Task: Analyze Google OAuth implementation for multi-device support.
Read: server/api/auth.ts, server/middleware/auth.ts, src/contexts/AuthContext.tsx,
      src/pages/LoginPage.tsx, src/services/api.ts, prisma/schema.prisma
Check for: single-session enforcement, token invalidation on login,
          device-specific restrictions, Google Cloud Console config issues.
Report: root cause of multi-device login failures, specific code locations.
Do NOT modify code — only diagnose.
```

**Agent 3: AI/Prompts Analysis**
```
Task: Analyze all Gemini AI integrations and prompts in the Stylist app.
Read: server/services/gemini.ts, server/services/color-analysis.ts,
      server/services/styling/outfit-generator.ts, server/services/styling/rules-engine.ts,
      .claude/prompts/*.md, server/api/styling.ts, server/api/scanner.ts
Document: each prompt's purpose, input/output schema, quality assessment.
Explain: how outfit generation works, what's code vs AI, can prompts be modified.
Do NOT modify code — only analyze and report.
```

### Phase 2: Bug fixes (sequential, based on Phase 1 findings)

Based on diagnostic results, fix issues in order of priority:

1. **Fix multi-device auth** — Apply the fix identified by Agent 2
   - After fix: run `npm run typecheck`
   - Verify JWT is fully stateless (no session tracking in DB)

2. **Any other bugs** found during diagnostics

### Phase 3: Feature implementation (sequential)

Implement requested features one at a time:

1. **Google Drive integration** — Add "Upload from Google Drive" button to ImportPage
   - Follow the add-google-drive-integration skill workflow
   - After implementation: typecheck + manual test

2. **Other requested features** — Implement as specified by user

### Phase 4: Feasibility analysis (parallel sub-agents, NO implementation)

For features the user wants analyzed but NOT implemented, launch parallel research agents:

Each feasibility agent should:
- Analyze the current codebase for relevant extension points
- Research required external APIs (pricing, availability, limitations)
- Assess complexity and produce a structured report
- Follow the feature-feasibility skill format

Common feasibility topics for Stylist:
- AI body/skin analysis from photos
- Virtual try-on image generation (e.g., using Imagen/Nano)
- Clothing search across online stores
- Social platform integration (Instagram, OLX, Telegram)

### Phase 5: Summary and next steps

After all phases complete, produce a unified report:

```markdown
## Stylist Project Report

### Diagnostics
- Git sync: [status]
- Auth: [status + fix applied]
- AI integration: [summary]

### Changes made
1. [Change 1 — file(s) affected]
2. [Change 2 — file(s) affected]

### Feasibility analyses
1. [Feature 1]: [verdict]
2. [Feature 2]: [verdict]

### Recommended next steps
1. [Priority action]
2. [Priority action]

### Deployment
- [ ] All changes committed
- [ ] Typecheck passes
- [ ] Ready to push to main (triggers Railway deploy)
```

## Execution guidelines

- **Parallel where possible**: Phase 1 agents and Phase 4 agents run simultaneously
- **Sequential where dependent**: Phase 2 depends on Phase 1 results, Phase 3 is ordered
- **Sub-agent types**: Use `Explore` for research, `researcher` for deep analysis, `implementer` for code changes, `verifier` after changes
- **Browser tasks**: Use Playwright MCP for Google Cloud Console, Railway dashboard, deployed app testing
- **Never auto-push**: Always ask user before pushing to GitHub (triggers Railway deploy)
- **Safety**: Verify .env is in .gitignore, never commit secrets, check staged files before commits
- **Quality gates**: Run typecheck after every code change, run relevant tests before committing

## Adapting the plan

The user's task may not include all phases. Read their request carefully and:
- Skip phases they didn't ask for
- Add phases for tasks not covered above
- Adjust sub-agent prompts based on specific details they provide
- If the user says "don't implement, just analyze" — skip Phases 2-3, only do 1 and 4
