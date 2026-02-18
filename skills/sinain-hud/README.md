# sinain-hud Skill

Skill definition for the sinain-hud agent: HUD integration + self-improving heartbeat for the OpenClaw gateway.

## What This Does

Defines how the OpenClaw agent interacts with sinain-core on the user's Mac:
- **SKILL.md** — agent behavior: handle escalations, spawn subagents, read session history, process feedback
- **HEARTBEAT.md** — self-improving loop: git backup → observe & act → reflect & curate (runs every 30m)

## Files

| File | Purpose |
|---|---|
| `SKILL.md` | Agent skill definition (escalation handling, spawn tasks, feedback learning, proactive research) |
| `HEARTBEAT.md` | Heartbeat protocol (3-phase self-improving loop with playbook curation) |
| `openclaw-config-patch.json` | Required gateway config: heartbeat cadence, cross-session visibility |

## Deployment

These files are deployed to `/mnt/openclaw-state/sinain-sources/` on the strato server. The **sinain-hud plugin** auto-copies them to the agent workspace on every agent start.

### Initial setup / manual deploy

```bash
# Upload skill files to the persistent source directory
scp -i ~/.ssh/id_ed25519_strato \
  skills/sinain-hud/HEARTBEAT.md \
  skills/sinain-hud/SKILL.md \
  root@85.214.180.247:/mnt/openclaw-state/sinain-sources/

# Files are picked up on the next agent start (no restart needed)
```

### Config patch

Merge `openclaw-config-patch.json` into the server's `/mnt/openclaw-state/openclaw.json`:

```json
{
  "agents.defaults.sandbox.sessionToolsVisibility": "all",
  "agents.defaults.heartbeat.every": "30m",
  "agents.defaults.heartbeat.prompt": "Execute HEARTBEAT.md — all phases, all steps, in order..."
}
```

- `sessionToolsVisibility: "all"` — allows the agent to read cross-session history (required for `sessions_history`)
- `heartbeat.every: "30m"` — heartbeat cadence
- `heartbeat.ackMaxChars: 0` — suppresses heartbeat acknowledgment messages

After merging config, restart the gateway:
```bash
ssh -i ~/.ssh/id_ed25519_strato root@85.214.180.247 \
  'cd /opt/openclaw && docker compose restart'
```

## How It Relates to sinain-hud-plugin

The **plugin** manages the lifecycle; the **skill** defines the behavior:

```
sinain-hud-plugin (server)          sinain-hud skill (this directory)
──────────────────────              ──────────────────────────────────
Hooks into gateway events           Defines what the agent does
Auto-deploys files to workspace     SKILL.md = escalation handling
Strips <private> tags               HEARTBEAT.md = self-improving loop
Tracks tool usage                   Config patch = gateway settings
Writes session summaries
```

The plugin reads SKILL.md and HEARTBEAT.md from `sinain-sources/` and deploys them. The agent reads them from the workspace and follows the instructions.

## Source of Truth

- `HEARTBEAT.md` — primary source is `sinain-hud` repo (`skills/sinain-hud/HEARTBEAT.md`), copied here for co-location
- `SKILL.md` — primary source is this directory (openclaw fork)
- `openclaw-config-patch.json` — primary source is this directory
