---
name: git-sync-check
description: Compare local code with GitHub remote repository. Use this skill when the user asks to check if local code matches GitHub, verify sync status, find uncommitted/unpushed changes, or diagnose local-vs-remote drift. Trigger on mentions of "git sync", "compare with GitHub", "is code up to date", "check remote", or any concern about local and remote code divergence.
---

# Git Sync Check

Compare the local repository state against the GitHub remote and produce a clear sync report.

## Workflow

### Step 1: Gather state (run all in parallel)

Run these git commands simultaneously to collect the full picture:

```bash
git -C "$PROJECT_DIR" fetch origin --prune
```

```bash
git -C "$PROJECT_DIR" status -sb
```

```bash
git -C "$PROJECT_DIR" log --oneline -10
```

```bash
git -C "$PROJECT_DIR" remote -v
```

```bash
git -C "$PROJECT_DIR" branch -vv
```

Where `$PROJECT_DIR` defaults to the current working directory. If the user specifies a path, use that instead.

### Step 2: Detect divergence

After fetch, run these comparisons:

```bash
# Commits on remote not in local
git -C "$PROJECT_DIR" log HEAD..origin/main --oneline

# Commits on local not in remote
git -C "$PROJECT_DIR" log origin/main..HEAD --oneline

# File-level diff summary between local and remote
git -C "$PROJECT_DIR" diff --stat origin/main

# Detailed diff (only if divergence is small — fewer than 20 files)
git -C "$PROJECT_DIR" diff origin/main
```

If the default branch is not `main`, detect it first:
```bash
git -C "$PROJECT_DIR" symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'
```

### Step 3: Check for uncommitted work

```bash
# Unstaged changes
git -C "$PROJECT_DIR" diff --stat

# Staged but uncommitted
git -C "$PROJECT_DIR" diff --cached --stat

# Untracked files (not -uall to avoid memory issues)
git -C "$PROJECT_DIR" status --short
```

### Step 4: Check .env safety

Verify sensitive files are not tracked:
```bash
git -C "$PROJECT_DIR" ls-files --cached | grep -E '\.(env|pem|key)$'
```

If any matches found — warn the user immediately.

### Step 5: Produce the report

Output a structured markdown report:

```
## Git Sync Report: [repo name]

**Remote:** [origin URL]
**Branch:** [current branch] → [tracking branch]
**Status:** ✅ In sync / ⚠️ Diverged / ❌ Out of sync

### Uncommitted changes
- Unstaged: [count] files
- Staged: [count] files
- Untracked: [count] files

### Local vs Remote
- Local ahead by: [N] commits
- Remote ahead by: [N] commits
- Files changed: [list if < 20, count if more]

### Security check
- .env tracked: ✅ No / ❌ YES — REMOVE IMMEDIATELY

### Recommendations
[Actionable next steps based on findings]
```

## Important notes

- Never run `git push` or `git pull` automatically — only report and recommend.
- If the user asks to fix the sync, confirm the action before proceeding (push, pull, merge).
- If there are merge conflicts, list them and ask the user how to resolve.
- For Railway-deployed projects: remind the user that pushing to main triggers auto-deploy.
