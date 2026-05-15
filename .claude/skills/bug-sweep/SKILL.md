---
name: bug-sweep
description: One-shot quality gate for Pocket Stylist — runs typecheck, lint, tests, live /api/status probe, i18n key audit, and auth-boundary check. Use this skill whenever the user asks "перевір код на баги", "повний тест", "audit перед коммітом", "знайди помилки в додатку", "is this safe to deploy", or after any non-trivial feature change in this repo. Delegates to the stylist-bug-hunter subagent.
---

# Bug Sweep — Pocket Stylist quality gate

This skill is the standard "is the app healthy?" check for Pocket Stylist. It MUST be invoked:

- before every `git commit` of non-trivial changes,
- before pushing to `main` (which triggers Railway auto-deploy),
- whenever the user explicitly asks for a bug check / audit / smoke test.

## How to run

Invoke the **stylist-bug-hunter** agent with this prompt (substitute the changed-files list):

```
Audit Pocket Stylist for bugs after this change set:

CHANGED FILES:
<paste output of `git diff --name-only HEAD~1` here, or "uncommitted: $(git status --short)">

CONTEXT:
- Working dir: G:\Веб-додатки\Stylist
- Live URL: https://pocket-stylist-production.up.railway.app
- Run: typecheck, lint, npm test, /api/status probe, i18n key audit, auth-boundary audit.
- Return the prioritized bug report; do NOT modify any file.
```

## After the agent reports

1. **P0 bugs** → fix immediately. Re-invoke the agent after fixes; do not commit until P0 is empty.
2. **P1 bugs** → fix in the same PR if the change is small; otherwise spawn a follow-up task with `mcp__ccd_session__spawn_task`.
3. **P2 bugs** → log them in `.claude/blockers.md` under today's date for the next sprint.

## Decline this skill when

- The change is a one-line typo fix in markdown or a comment — overkill.
- The user is in the middle of an unfinished refactor and explicitly said "not yet".
- The repo is not Pocket Stylist (check `package.json#name === "pocket-stylist"`).

## Failure modes to watch for

- **Stale Prisma client** → if typecheck errors mention Prisma model fields you just added, run `npx prisma generate` first; the agent will flag this in the report.
- **Live status probe fails** → record it as ❓ in "Verified clean", do not block the commit on a network hiccup.
- **i18n key in both locales but different shape** → P1 (UI will render the key string in one language).
