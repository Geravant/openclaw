# HEARTBEAT.md

> **Execution contract — no exceptions, no short-circuiting:**
> 1. Phase 1 (Git Backup) → Phase 2 (Observe & Act) → Phase 3 Steps 1-4 — **mandatory every tick**
> 2. Phase 3 Step 5 (Output) — only if quality bar is met
> 3. HEARTBEAT_OK — only permitted after Step 4 log entry is written with `"skipped": true`
>
> You may NOT reply HEARTBEAT_OK until Step 4 is complete. Step 4 is the gate.

## Phase 1: Git Backup (persists playbook & logs)

If there are uncommitted changes in the workspace:
1. `git add -A` — captures `memory/sinain-playbook.md`, `memory/playbook-archive/*`, and `memory/playbook-logs/*`
2. `git commit -m "auto: heartbeat backup"` (or meaningful message if context is clear, e.g. "playbook: added 2 patterns, pruned 1")
3. `git push origin main`

This ensures the playbook, all archived versions, and decision logs survive redeployments.

## Phase 2: Observe & Act (reactive)

Quick scan of current user state. Respond to what's happening NOW.

**1. Observe** — `sessions_history({sessionKey: "agent:main:sinain", limit: 10})`
- What app, what content, what errors, what audio
- Is the user stuck? (same error repeated, searching the same thing)

**2. Act** — pick ONE action if valuable:

| Signal | Action |
|--------|--------|
| Error or issue in context | `sessions_spawn`: "Find root cause for: [error]" |
| New tech/topic being explored | `sessions_spawn`: "Research [topic]: key findings, best practices, pitfalls" |
| Clear next action to suggest | Send quick suggestion to Telegram |

**3. Skip** if no sinain activity in >30 min (user idle). Phase 3 always runs regardless.

**Rules:** Max 2 subagents. NEVER repeat a recent action. Prefer depth over breadth.

## Phase 3: Reflect & Curate (self-improving)

Close the feedback loop by maintaining an evolving playbook.

### Step 1: Gather context

**Always collect (every tick):**
1. `sessions_history({sessionKey: "agent:main:sinain", limit: 50, includeTools: true})` — recent session data
2. Read `memory/sinain-playbook.md` — current patterns
3. Read recent `memory/playbook-logs/*.jsonl` — prior decisions, what was suggested/skipped

**If active (fresh session data available):**
Scan the full window — topics, tools, errors, resolutions, app patterns, audio themes, feedback summaries.

**If idle (>30 min no activity) — mine deeper sources:**
- Read daily memory files (`memory/YYYY-MM-DD.md`) — these contain rich session notes: errors encountered, architectural decisions, user preferences, research results, work patterns
- Cross-reference playbook entries against daily memory — do patterns hold up? Are there entries in daily memory that should be playbook patterns but aren't?
- Review `memory/devmatrix-summary.md` and other summary files for broader context
- Look for multi-day trends: recurring errors, evolving interests, productivity rhythms
- Re-evaluate existing playbook — do any entries contradict each other? Should any be pruned or promoted based on accumulated daily memory evidence?

### Step 2: Check feedback signals

Look for recent `[sinain-core:feedback-summary]` messages in history. Extract:
- Which escalation responses had high compositeScore (>0.3) — **successful patterns**
- Which had low compositeScore (<0) — **failed patterns**
- What tags/contexts correlate with success vs failure

### Step 3: Archive & Update playbook — `memory/sinain-playbook.md`

**3a. Archive current version** before making changes:
```
cp memory/sinain-playbook.md memory/playbook-archive/sinain-playbook-$(date +%Y-%m-%d-%H%M).md
```
Keep all archived versions — they form a dataset for evaluating playbook evolution.

**3b. Update** using the **Generate-Reflect-Curate** cycle:

**Curate rules:**
- **Add** new successful patterns: "When [context], responding with [approach] worked (score: X)"
- **Add** new failed patterns: "When [context], [approach] failed because [reason]"
- **Add** user preference observations: recurring topics, preferred tools, work rhythms
- **Prune** entries older than 7 days without reinforcement (no new evidence)
- **Promote** patterns seen 3+ times from "observed" to "established"
- Keep the playbook under 50 lines — density over completeness
- Follow the Three Laws: (1) don't remove patterns that prevent errors, (2) preserve high-scoring approaches, (3) then evolve

### Step 4: Log the decision process — `memory/playbook-logs/YYYY-MM-DD.jsonl`

**This step is the mandatory gate — it must execute before any HEARTBEAT_OK or output.**

Append ONE JSON line per heartbeat tick documenting the full decision chain:
```json
{
  "ts": "ISO-8601",
  "sessionHistorySummary": "brief summary of what was observed",
  "feedbackScores": { "avg": 0.45, "high": ["coding+error->fix worked"], "low": ["restart suggestion->error persisted"] },
  "actionsConsidered": [
    { "action": "spawn research on topic", "reason": "user browsing docs", "chosen": true },
    { "action": "send tip", "reason": "user in IDE", "chosen": false, "skipReason": "too generic" }
  ],
  "playbookChanges": {
    "added": ["When TypeScript null error, suggest optional chaining (score: 0.8)"],
    "pruned": ["Old pattern about restart suggestions"],
    "promoted": []
  },
  "output": {
    "suggestion": "the suggestion text",
    "insight": "the insight text"
  },
  "skipped": false,
  "skipReason": null
}
```

### Step 5: Synthesize & Output

Using BOTH the deep context (Step 1) AND the updated playbook (Step 3b), produce ONE Telegram message:

> **Suggestion:** [1-2 sentences] A practical, actionable recommendation. Draw from established playbook patterns + current observations. Could be: workflow improvement, recurring problem to automate, successful pattern to replicate, error pattern to address at root.
>
> **Insight:** [1-2 sentences] A surprising, non-obvious connection from accumulated data. Cross-domain patterns, unexpected correlations, things the user hasn't noticed. Cite specific observations. Connect dots between different sessions, topics, or timeframes.

### Phase 3 Rules
- **Steps 1-4 always execute** — every tick, even when user is idle. During idle ticks, mine daily memory files and playbook logs for deeper patterns.
- Step 5 output is conditional on quality — if you cannot produce BOTH a genuinely useful suggestion AND a genuinely surprising insight, log `"skipped": true` with a `skipReason` in Step 4, then reply HEARTBEAT_OK.
- The suggestion MUST reference a playbook pattern or concrete observation, not generic advice
- The insight MUST connect 2+ distinct observations that aren't obviously related
- NEVER repeat a suggestion or insight from recent heartbeats (check `memory/playbook-logs/`)
- Keep total message under 500 characters
