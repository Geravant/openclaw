# Strato VPS Deployment

OpenClaw Gateway running on a Strato VPS (Debian 12) with local disk-backed persistent state.

## Server Details

| Resource | Value |
|---|---|
| Public IP | `85.214.180.247` |
| OS | Debian 12 (Bookworm) |
| SSH user | `root` |
| SSH key | `~/.ssh/id_ed25519_strato` |
| App directory | `/opt/openclaw` |
| State directory | `/mnt/openclaw-state` |

## Endpoints

| Service | URL |
|---|---|
| Gateway (WebSocket) | `ws://85.214.180.247:18789` |
| Bridge | `http://85.214.180.247:18790` |
| Container SSH | `ssh -p 2222 node@85.214.180.247` |
| Feed relay | `ws://85.214.180.247:18791` |

## SSH Access

```bash
ssh -i ~/.ssh/id_ed25519_strato root@85.214.180.247
```

## Managing the Gateway

All commands assume you are SSH'd into the server. The app lives at `/opt/openclaw` and state is persisted on local disk at `/mnt/openclaw-state`.

### View logs

```bash
cd /opt/openclaw
docker compose logs --tail 50
docker compose logs -f          # follow live
```

### Restart the container

```bash
cd /opt/openclaw
docker compose restart
```

### Stop / start

```bash
cd /opt/openclaw
docker compose stop
docker compose up -d
```

### Rebuild (e.g. after OpenClaw releases a new version)

```bash
cd /opt/openclaw
docker compose up -d --build --pull always
```

### Run openclaw CLI inside the container

```bash
docker compose exec openclaw-gateway openclaw channels status
docker compose exec openclaw-gateway openclaw config get
```

### Interactive shell inside the container

```bash
docker compose exec openclaw-gateway bash
```

## State and Persistence

All gateway state is stored on local disk, bind-mounted at `/mnt/openclaw-state` on the host and `/home/node/.openclaw` inside the container. This includes:

- `openclaw.json` -- main configuration
- `credentials/` -- API keys, OAuth tokens
- `agents/` -- agent state and session transcripts
- `telegram/` -- Telegram channel state
- `media/` -- downloaded/cached media
- `cron/`, `memory/`, `hooks/`, `workspace/` -- other runtime state

State persists across container restarts and host reboots.

Additional state directories added by plugins:

| Directory | Purpose |
|---|---|
| `extensions/sinain-hud/` | sinain-hud plugin (lifecycle hooks, auto-deploy) |
| `extensions/claude-mem/` | claude-mem plugin (memory, vectors, observation feed) |
| `sinain-sources/` | HEARTBEAT.md + SKILL.md source files (auto-deployed to workspace) |
| `claude-mem/` | claude-mem worker data (symlinked from `~/.claude-mem`) |
| `start-services.sh` | Startup script for background workers |

### Browse state on the host

```bash
ls -la /mnt/openclaw-state/
```

## Deployment Files

On the server at `/opt/openclaw`:

| File | Purpose |
|---|---|
| `docker-compose.yml` | Compose config (bind mount to `/mnt/openclaw-state`) |
| `Dockerfile.openclaw` | Container image definition |
| `authorized_keys` | SSH keys for container access |
| `.env` | Secrets (API keys, tokens) |

## Key Differences from AWS

| Aspect | AWS (previous) | Strato (current) |
|---|---|---|
| Host OS | Amazon Linux 2023 | Debian 12 |
| State storage | EFS (network filesystem) | Local disk bind mount |
| SSH user | `ec2-user` | `root` |
| SSH key | `~/.ssh/openclaw-gateway.pem` | `~/.ssh/id_ed25519_strato` |
| Docker install | dnf + manual compose | Official Docker apt repo |
| Docker commands | `sudo docker compose ...` | `docker compose ...` (root) |

## Installed Plugins

Two plugins are installed in `/mnt/openclaw-state/extensions/`:

### sinain-hud

Agent lifecycle management for the sinain-hud integration.

| Feature | Description |
|---|---|
| File auto-deploy | Syncs HEARTBEAT.md + SKILL.md from `sinain-sources/` to workspace on agent start |
| Privacy stripping | Removes `<private>` tags from tool results before persistence |
| Session summaries | Writes tool usage stats to `memory/session-summaries.jsonl` on agent end |
| `/sinain_status` | Command to check active sessions and tool call counts |

Configuration in `openclaw.json` under `plugins.entries.sinain-hud`.

### claude-mem

Persistent memory with vector search and observation feed.

| Feature | Description |
|---|---|
| Memory storage | Structured observations with vector similarity search |
| Observation feed | SSE stream → Telegram (chat 59835117) |
| Background worker | Runs on port 37777, started by `start-services.sh` |

Configuration in `openclaw.json` under `plugins.entries.claude-mem`.

### Updating plugins

```bash
# Upload updated plugin files
scp -i ~/.ssh/id_ed25519_strato \
  <plugin-dir>/index.ts <plugin-dir>/openclaw.plugin.json \
  root@85.214.180.247:/mnt/openclaw-state/extensions/<plugin-name>/

# Restart to reload
cd /opt/openclaw && docker compose restart
```

## Background Services

### claude-mem worker

The claude-mem plugin runs a background worker process (Bun-based, port 37777) for vector search and observation streaming.

**Lifecycle:**
- Started by `/mnt/openclaw-state/start-services.sh`, which is chained into the docker-compose startup command
- Survives `docker compose restart` (compose command chain re-runs)
- Survives `docker compose down/up` (`start-services.sh` re-starts the worker)
- Does NOT survive container rebuild — Bun needs to be re-installed at `/home/node/.bun/bin/bun`

**Health check:**
```bash
docker compose exec openclaw-gateway curl -s http://localhost:37777/health
```

### start-services.sh

Located at `/mnt/openclaw-state/start-services.sh`. Runs at container startup (before the gateway process) to initialize background workers:
- Installs Bun if missing
- Starts the claude-mem worker in the background
- Any additional background services

## Observation Feed

The observation feed streams structured observations from the agent to Telegram in real-time:

```
Agent activity → claude-mem stores observation → SSE stream → Telegram bot → Chat 59835117
```

Observations include:
- Screen capture events (app, window, OCR text)
- Agent actions (tool usage, escalation responses)
- Session lifecycle events

The feed is configured in `openclaw.json` under the claude-mem plugin's `observationFeed` settings.
