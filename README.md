# Month Planner

Month Planner is a local calendar for planning one-off and recurring tasks. It includes month and week views, per-occurrence completion, skip and restore, drag-and-drop rescheduling, task ordering, and light and dark themes. Task data is stored in a SQLite database through the `sql.js` driver.

## Requirements

- Node.js 20 or newer
- pnpm 11 or newer

## Development

From the repository root:

```powershell
pnpm install
pnpm dev
```

Open the Vite URL printed in the terminal (usually http://localhost:5173). The NestJS API listens on port 3003, and Vite proxies `/api` requests to it. The development command waits for the API to be ready before starting Vite.

## Production

Build both applications and start the API, which also serves the built frontend:

```powershell
pnpm build
pnpm start
```

Then open http://localhost:3003. The database is created at `backend/data/planner.db` by default; set `PLANNER_DB_PATH` to use a different file. Because the database uses `sql.js`, no native SQLite build tools are required.

## Tasks and recurrence

Tasks can be one-off, daily, weekly on selected weekdays, every two weeks (anchored to the start date), or monthly on a chosen day. Monthly days 29–31 are clamped to the last day of shorter months. An optional end date limits a series. Editing a task updates its series; an individual occurrence can be completed, skipped or restored, or moved to another date. Drag tasks to move an occurrence or reorder the task list.

## Tests

Run the backend test suite from the repository root:

```powershell
pnpm test
```

## Dependency security

The `braces@3.0.3` transitive dependency currently has no fixed release in the npm registry. The workspace applies `patches/braces@3.0.3.patch`, which rejects brace and parenthesis nesting beyond 100 levels and guards the recursive AST walkers. Since registry-based audits do not inspect local patches, the workspace suppresses only this GHSA while the patch is in place. Replace the local patch and remove the audit exception when an upstream fix is published.
