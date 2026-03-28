# Glob: backend/**/*.ts

## Backend Rules

- Express 5 with TypeScript — use `async` route handlers
- Read env vars inside functions, never at module top level
- JWT auth: read `process.env.JWT_SECRET` inside the auth middleware function
- Database: better-sqlite3 with Drizzle ORM
- Schema changes: run `cd backend && npx drizzle-kit push` after modifying schema.ts
- Use `position` not `order`, `status` not `column` in task queries
- CC_BOT_KEY required for agent/bot endpoints — validate in middleware
- API responses: `{ data }` for success, `{ error }` for failures
- Keep route files focused — one resource per file
