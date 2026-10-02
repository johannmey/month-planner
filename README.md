# Month Planner

A local monthly task planner with recurring tasks, per-day completion, and a SQLite database written by the lightweight sql.js driver.

## Requirements

- Node.js 20 or newer
- pnpm 9 or newer

## Development

```powershell
pnpm install
pnpm dev
```

Open the Vite URL printed in the terminal (usually http://localhost:5173). The API runs locally on port 3003 and Vite proxies `/api` requests to it. The dev script waits for the API to be ready before starting Vite, avoiding startup-time proxy connection errors.

## Production

```powershell
pnpm build
pnpm start
```

Then open http://localhost:3003. SQLite data is stored in `backend/data/planner.db` by default. Set `PLANNER_DB_PATH` to use a different path. The database uses sql.js, so no native SQLite build tools are needed.

## Recurrence

Tasks can be one-off, daily, weekly on selected weekdays, every two weeks (anchored to the start date), or monthly on a day number. Monthly days 29–31 are clamped to the last day of shorter months. Editing a task changes its series; an individual occurrence can be skipped or unskipped from its day panel.
