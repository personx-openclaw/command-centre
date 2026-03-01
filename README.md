# OpenClaw Command Centre

**Module 1: Foundation + Kanban Board**

A private, single-user command centre web dashboard — your central operating system for running an AI startup, managing training, tracking learning, and organizing life.

Bloomberg Terminal meets Linear meets quantified-self dashboard.

## Tech Stack

### Client
- React 19 + Vite 6 + TypeScript
- shadcn/ui components (Radix UI)
- Tailwind CSS v4 (dark mode only)
- Geist Sans + Geist Mono fonts
- Framer Motion (animations)
- TanStack Router + Query v5
- Zustand (UI state)

### Server
- Node.js 22 + Express 5 + TypeScript
- SQLite (WAL mode) + better-sqlite3
- Drizzle ORM
- JWT auth (15min access + 7day refresh)
- Rate limiting (5 attempts/min, 60s lockout)
- 30min inactivity timeout

## Module 1 Features

**Foundation:**
- Authentication (username/password + JWT with refresh tokens)
- Layout shell (collapsible sidebar, header with command palette trigger)
- Dark-mode design system with CSS variables

**Kanban Board:**
- 4 columns: Backlog → Today → In Progress → Done
- Task priorities: Urgent, High, Medium, Low
- Task sources: Manual, Telegram, Morning Report
- Smooth animations (entrance, hover, drag)
- Quick-add task form

## Setup

```bash
# Server
cd server
npm install
cp ../.env.example .env  # Configure JWT secrets
npm run db:generate
npm run db:migrate

# Create first user
npm run seed:user -- --username karim --password <your-password>

# Run server (port 3000)
npm run dev

# Client (separate terminal)
cd client
npm install
npm run dev  # port 5173
```

## Production (Docker)

```bash
cp .env.example .env  # Configure for production
docker-compose up --build
```

Access at `http://localhost:80`

## Design System

- **Base spacing:** 4px grid
- **Card padding:** 24px (p-6)
- **Border radius:** 12px (rounded-xl)
- **Sidebar:** 240px expanded, 64px collapsed
- **Typography:** Geist Sans 14px min, semi-bold 600 headings
- **Colors:** Defined in `client/tailwind.config.ts`
- **Animations:** 200ms page transitions, 50ms stagger, spring drag

## API Endpoints

### Auth
- `POST /api/auth/login` - Login (returns access token + sets refresh cookie)
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout (clears refresh token)
- `GET /api/auth/me` - Get current user

### Kanban
- `GET /api/kanban/tasks` - Get all tasks
- `POST /api/kanban/tasks` - Create task
- `PATCH /api/kanban/tasks/:id` - Update task
- `DELETE /api/kanban/tasks/:id` - Delete task
- `POST /api/kanban/tasks/reorder` - Batch reorder tasks

## Roadmap

Module 1 (✓ Complete) - Foundation + Kanban  
Module 2 - Analytics Dashboard  
Module 3 - Goal Tracking  
Module 4 - Habit Tracker  
Module 5 - Time Tracking  
Module 6 - Learning Log  
Module 7 - Finance Overview  
Module 8 - Health Metrics  
Module 9 - Content Pipeline  
Module 10 - AI Chat Interface  
Module 11 - Telegram Integration  
Module 12 - Insights & Reports  

---

**Status:** Module 1 Foundation Complete  
**Next:** Module 2 Analytics Dashboard
