# Command Centre - Module 1 Implementation Status

## ✅ Complete

### Server
- [x] package.json with all dependencies
- [x] Schema with fractional position (text field)
- [x] Auth routes (login, refresh, logout, me)
- [x] Kanban routes (GET, POST, PATCH, DELETE, move, reorder)
- [x] Auth middleware with rate limiting
- [x] Database setup (SQLite WAL mode)
- [x] User seed script

### Client - Infrastructure
- [x] package.json with dnd-kit, date-fns, react-markdown
- [x] Fractional indexing utility
- [x] API client with Task types
- [x] Sidebar with all 12 nav items (only Tasks active, rest "Coming Soon")

## 🚧 Remaining (High Priority)

### Client - Kanban Board
- [ ] Kanban board component with @dnd-kit
  - [ ] DndContext, SortableContext per column
  - [ ] Drag overlay with rotation + shadow
  - [ ] Drop zone highlighting (accent-primary-muted)
  - [ ] Task cards with priority left border
  - [ ] Tag pills, due date badges (red/amber)
  - [ ] Source icons (Telegram, Morning Report)
  - [ ] Inline quick-add on + button click
  
- [ ] Task detail slide-over panel
  - [ ] Title inline edit
  - [ ] Markdown description with preview toggle
  - [ ] Priority dropdown
  - [ ] Tag input (comma-separated)
  - [ ] Date picker for due date
  - [ ] Delete with confirmation
  - [ ] Close on Escape/outside click

- [ ] Filters bar
  - [ ] Text search (live)
  - [ ] Priority multi-select
  - [ ] Tag multi-select
  - [ ] Animated card entrance/exit

- [ ] Keyboard shortcuts
  - [ ] N = new task in Backlog
  - [ ] F = focus search
  - [ ] Arrow keys in detail panel

### Client - Components (shadcn/ui)
- [ ] Dialog (for task detail panel)
- [ ] Dropdown Menu (priority select)
- [ ] Popover (date picker)
- [ ] Badge (tags, priority)
- [ ] Tooltip (already added to sidebar)

### Client - Routes
- [ ] /tasks route (main kanban)
- [ ] Update __root.tsx with Toaster
- [ ] Login page

### Client - Stores
- [ ] ui.ts (sidebar, command palette state)
- [ ] auth.ts

## 📋 File Creation Checklist

Priority order for next session:

1. `client/src/components/ui/dialog.tsx`
2. `client/src/components/ui/dropdown-menu.tsx`
3. `client/src/components/ui/badge.tsx`
4. `client/src/components/modules/kanban/task-card.tsx`
5. `client/src/components/modules/kanban/kanban-column.tsx`
6. `client/src/components/modules/kanban/kanban-board.tsx` (main component)
7. `client/src/components/modules/kanban/task-detail-panel.tsx`
8. `client/src/components/modules/kanban/filters-bar.tsx`
9. `client/src/hooks/use-keyboard-shortcuts.ts`
10. `client/src/routes/tasks.tsx`

## Design Spec Quick Reference

**Column Colors (dot indicator)**:
- Backlog: `#52525B`
- Today: `#6366F1`
- In Progress: `#F59E0B`
- Done: `#10B981`

**Priority Border (left-border-4)**:
- Urgent: `#EF4444` (red)
- High: `#F59E0B` (orange)
- Medium: `#3B82F6` (blue)
- Low: `#52525B` (gray)

**Due Date Badge**:
- Overdue: `bg-semantic-error text-white`
- Today: `bg-semantic-warning text-white`
- Future: `bg-bg-elevated text-text-muted`

**Drag & Drop**:
- Drag overlay: `rotate-3 shadow-2xl scale-105`
- Drop target: `bg-accent-primary-muted border-2 border-accent-primary`
- Spring config: `{ type: "spring", stiffness: 300, damping: 30 }`

**Animations**:
- Page transition: 200ms fade + slide
- Card entrance: staggerChildren 50ms
- Hover: `whileHover={{ scale: 1.01 }}`

## Next Steps

1. Create all shadcn/ui components
2. Build Kanban board with dnd-kit
3. Add task detail panel
4. Implement filters
5. Add keyboard shortcuts
6. Test drag-and-drop flow
7. Push all files to GitHub

## Commands to Remember

```bash
# Always export token first
export GH_TOKEN=$(cat /home/node/.openclaw/workspace/.gh-token)

# Push new file
cat /path/to/file | base64 -w 0 | xargs -I {} /usr/bin/gh api repos/personx-openclaw/command-centre/contents/path/in/repo -X PUT -f message='Add file' -f content='{}'

# Update existing file
SHA=$(/usr/bin/gh api repos/personx-openclaw/command-centre/contents/path/in/repo --jq .sha)
cat /path/to/file | base64 -w 0 | xargs -I {} /usr/bin/gh api repos/personx-openclaw/command-centre/contents/path/in/repo -X PUT -f message='Update file' -f content='{}' -f sha="$SHA"
```
