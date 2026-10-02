# Month Planner – Implementation Plan

## Problem
A locally-run website with a monthly calendar view to plan daily tasks, most of them recurring, and tick them off per day.

## Decisions (confirmed with user)
- **Stack**: pnpm workspaces monorepo — `frontend/` (React + Vite + TypeScript) and `backend/` (NestJS + TypeScript).
- **Storage**: SQLite file (`backend/data/planner.db`) via TypeORM + sql.js. sql.js was selected to avoid native build tooling while keeping the database portable.
- **Recurrence**: one-off, daily, weekly (chosen weekdays), biweekly (every 14 days from start date), monthly (day-of-month). Monthly day 29–31 → clamped to the last day of shorter months.
- **Missed tasks**: stay on their original day, shown as overdue (red) when date < today and not done.
- **UI**: Calendar grid, week starts Monday; each day cell shows task titles with checkboxes; clicking a day opens a detail panel (add/edit/skip/delete).
- **Editing scope**: edits apply to the whole series; single occurrences can be skipped ("skip this day").
- **Task fields**: title, optional notes, optional color/category.
- **Running**: `pnpm dev` starts both after the Nest API is ready (Vite proxies `/api` to port 3003). `pnpm build && pnpm start` → NestJS serves the built React app at http://localhost:3003.

## Architecture
```
month-planner/
  package.json            # root scripts: dev, build, start, test
  pnpm-workspace.yaml
  backend/                # NestJS + TypeORM + SQLite (sql.js)
    src/tasks/            # Task entity, CRUD controller/service
    src/occurrences/      # GET occurrences for a date range, completions & skips
    src/recurrence/       # pure recurrence expansion logic (unit-tested)
  frontend/               # Vite + React
    src/api.ts            # typed fetch client
    src/App.tsx           # month grid, day panel, task form
```

### Data model
- **Task**: id, title, notes?, color?, recurrenceType (`once|daily|weekly|monthly`), startDate, endDate?, weekdays? (for weekly, e.g. [1,3,5]), dayOfMonth? (monthly), date (for once = startDate), createdAt.
- **Completion**: id, taskId, date (YYYY-MM-DD), completedAt. Unique (taskId, date).
- **Skip**: id, taskId, date. Unique (taskId, date).
- Deleting a task cascades its completions/skips. Recurring tasks get an optional end date ("stop recurring from …") so history is preserved.

### API (prefix `/api`)
- `GET /tasks`, `POST /tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id`
- `GET /occurrences?from=YYYY-MM-DD&to=YYYY-MM-DD` → `[{ taskId, date, title, color, notes, done, overdue }]` (server expands recurrences, excludes skips)
- `PUT /tasks/:id/completions/:date` / `DELETE /tasks/:id/completions/:date` – mark done/undone
- `PUT /tasks/:id/skips/:date` / `DELETE /tasks/:id/skips/:date` – skip/unskip a single occurrence
- Validation via class-validator DTOs.

### Frontend
- Month header with prev/next/today navigation.
- 7-column grid (Mon–Sun), leading/trailing days from adjacent months greyed; today highlighted.
- Day cell: list of occurrences (color dot, checkbox, title; done = struck through, overdue = red); "+N more" when overflowing. Checkbox toggles completion in place.
- Day panel (side drawer/modal): full list, toggle done, skip occurrence, edit series, delete series, add new task (form with recurrence options).
- Data fetching with TanStack Query; date handling with date-fns. Plain CSS (CSS modules) — no heavy UI library.

## Implementation status
- [x] pnpm workspaces, Git repository, README, and ignored build/database artifacts.
- [x] NestJS API with TypeORM, a portable SQLite file, validation, and local-only binding.
- [x] Recurrence expansion for one-off, daily, weekly, biweekly, and clamped monthly tasks, with unit tests.
- [x] Task CRUD, completions, occurrence skips/restores, range validation, and API integration test.
- [x] React month grid with direct completion checkboxes, weekday-first layout, navigation, and overdue styling.
- [x] Day panel with task creation/series editing/deletion and per-occurrence skip/restore.
- [x] Vite development proxy and NestJS production static serving.
- [x] Production build, recurrence/API tests, live API smoke test, and persisted-data restart check.

## Notes
- No auth (local-only, single user). Server binds to localhost.
- DB file location configurable via env var; `backend/data/` is git-ignored.
- Dates are handled as local `YYYY-MM-DD` strings to avoid timezone drift.
- The frontend uses system fonts and makes no external asset requests.
