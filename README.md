# OpenClaw Command Centre

**Module 1: Foundation + Kanban Board**

A private, single-user command centre web dashboard — your central operating system for running an AI startup, managing training, tracking learning, and organizing life.

Think: Bloomberg Terminal meets Linear meets quantified-self dashboard.

## Tech Stack

### Frontend
- React 19 + Vite 6 + TypeScript
- shadcn/ui (copy-paste components, Radix UI base)
- Tailwind CSS v4 + CSS variables (dark mode)
- Geist Sans (UI) + Geist Mono (data/code)
- Framer Motion (animations)
- TanStack Router (type-safe routing)
- TanStack Query v5 (server state)
- Zustand (client state)

### Backend
- Node.js 22 + Express 5 + TypeScript
- SQLite (WAL mode) + better-sqlite3
- Drizzle ORM
- JWT auth (username/password)
- Server-Sent Events (SSE) for real-time updates

## Module 1 Scope

**Foundation:**
- Project scaffold
- Authentication system
- Layout shell (sidebar, header, command palette)

**First Feature:**
- Kanban board for task management

## Setup

```bash
# Install dependencies
cd frontend && npm install
cd ../backend && npm install

# Run dev servers
npm run dev # frontend (port 5173)
npm run dev # backend (port 3000)
```

## Architecture

```
command-centre/
├── frontend/          # React SPA
├── backend/           # Express API
└── shared/            # Shared types
```

---

**Module 1 of ~12** — Future modules will slot into this shell.
