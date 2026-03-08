---
name: build-phase
description: Execute a build phase of the Pocket Stylist app. Reads pipeline spec, plans, implements, verifies, commits. Argument = phase number (0-5).
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, Agent, TodoWrite
argument-hint: [phase-number 0-5]
---
Execute Phase $ARGUMENTS of the Pocket Stylist app.

## Step 1: Read context
- Read .claude/pipelines/pocket-stylist-pipeline.md — find Phase $ARGUMENTS spec
- Read CLAUDE.md for project rules
- Read relevant .claude/rules/ files for coding standards
- Use researcher agent to check current codebase state and identify what already exists

## Step 2: Plan
- Create ordered implementation steps (3-7 steps)
- Each step: one file or one logical unit
- Write plan to .claude/plan.md with checkboxes
- For complex steps: use sequential-thinking MCP to reason through approach

## Step 3: Implement
For each step:
1. Write/edit code following project rules
2. Run: npm run typecheck && npm run lint
3. If a test file exists for the module: run that specific test
4. If check fails: fix immediately (max 2 attempts per issue)
5. If still failing after 2 attempts: flag in plan.md and move on
6. Mark step done in plan.md

## Step 4: Verify
- Run verifier agent (full check suite)
- Fix any failures it reports
- Verify no secrets in code (grep for API keys, passwords)

## Step 5: Commit
- Stage specific files: git add [list of changed files]
- NEVER use git add -A or git add . (risk of committing .env)
- Commit: git commit -m "feat(phase-$ARGUMENTS): [description]"
- Push: git push origin main

## Step 6: Report
Write to .claude/changes.md:
- Phase number and name
- Files created/modified (with brief purpose)
- Tests: which passed, which need writing
- Known issues or deferred items
- What the next phase needs as prerequisites
