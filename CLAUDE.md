# Command Centre

Personal command centre for Regulex — task management, prospect pipeline, and network CRM.

## Project Structure

```
command-centre/
├── frontend/          # React app (Vite) — NOT client/
├── backend/           # Express API — NOT server/
├── shared/            # Shared types
├── .claude/           # Claude Code config (agents, commands, rules)
└── plans/             # Implementation plans
```

Root workspaces: `["frontend", "backend", "shared"]`

## Tech Stack

- **Frontend**: React 19, Vite 6, TypeScript, TanStack Router, TanStack Query v5, Zustand, Tailwind v4, Framer Motion, Lucide icons, Geist font (CDN)
- **Backend**: Node.js 22, Express 5, TypeScript, better-sqlite3, Drizzle ORM, JWT auth
- **Database**: SQLite at `backend/data/command-centre.db`, schema at `backend/src/db/schema.ts`

## Critical Rules

- ALWAYS use `frontend/` not `client/`, `backend/` not `server/`
- Read env vars inside functions, not at module top level
- After schema changes: `cd backend && npx drizzle-kit push`
- After new route files: update `frontend/src/routeTree.gen.ts`
- API calls from frontend use `/api` prefix (Vite proxies to :3000)
- Database fields: `position` not `order`, `status` not `column`

## Current Modules

- `/tasks` — Kanban board with drag/drop and agent toggle
- `/prospects` — Outreach pipeline with research agent integration
- `/network` — CRM (partially complete)

## Services (systemd)

| Service | Description | Path |
|---------|-------------|------|
| command-centre | React + Express dev server (Vite :5173, Express :3000) | ~/command-centre/ |
| brief-service | Telegram morning brief at 6am | ~/brief-service/ |
| research-agent | Nightly prospect research at 11pm | ~/research-agent/ |
| task-agent | Polls every 2 min for agent tasks | ~/task-agent/ |

## Verifying Changes

```bash
curl -s -o /dev/null -w "%{http_code}" https://cc.regulex.io   # Should return 200
sudo journalctl -u command-centre -n 20                          # Check logs
sudo systemctl restart command-centre                            # Restart if needed
```

## GitHub

- Repo: `personx-openclaw/command-centre`
- CLI: use `/usr/bin/gh` not `gh`
- Token: `~/.openclaw/workspace/.gh-token`

## Workflows

- `/deploy` — commit, push, restart, verify
- `/rpi:research <feature>` — research feasibility before building
- `/rpi:plan <feature>` — create phased implementation plan
- `/rpi:implement <feature>` — execute plan phase by phase

## Model Routing (via OpenRouter)

- Haiku: classification, simple tasks
- Sonnet: research, drafting, market scans
- Opus: IC narrative, strategic writing, complex analysis

## Detailed Rules

See `.claude/rules/` for coding standards, design system, and backend patterns.
