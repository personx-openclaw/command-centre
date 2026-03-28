# Glob: **/*.{ts,tsx}

## TypeScript Standards

- Use TypeScript strict mode — no `any` types unless absolutely necessary
- Prefer `interface` over `type` for object shapes
- Use named exports, not default exports
- Destructure props in function signatures
- Use `const` by default, `let` only when reassignment is needed

## React Patterns

- Functional components only, no class components
- Use TanStack Query for all API data fetching — never `useEffect` + `fetch`
- Use Zustand stores for UI state (sidebar, modals, palettes)
- Co-locate component state with the component that owns it
- Use `cn()` utility for conditional classNames

## File Organization

- Routes go in `frontend/src/routes/`
- Shared components in `frontend/src/components/`
- API functions in `frontend/src/lib/api.ts`
- Backend routes in `backend/src/routes/`
- Database schema in `backend/src/db/schema.ts`

## Naming Conventions

- Files: kebab-case (`deal-card.tsx`)
- Components: PascalCase (`DealCard`)
- Functions/variables: camelCase
- Database columns: camelCase in schema, snake_case in SQL
- API endpoints: kebab-case (`/api/tasks`)
