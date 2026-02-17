# LinkedIn Automator (Localhost)

A personal-use LinkedIn outreach automation platform with a visual workflow builder, CSV lead imports, Playwright execution engine, and Supabase-backed realtime logs.

## Stack
- Next.js 14 (App Router), TailwindCSS, React Flow, Zustand
- Bun server + Playwright (visible Chromium)
- Supabase Postgres + Realtime

## Prerequisites
- Bun (latest)
- Node.js 18+
- A Supabase project (free tier works)

## Setup
```bash
# 1. Install dependencies
bun install
cd bun-server && bun install && cd ..

# 2. Install Playwright browser
cd bun-server && bunx playwright install chromium && cd ..

# 3. Create Supabase tables
# Run the SQL in supabase/migrations/001_initial.sql in your Supabase SQL editor

# 4. Configure env vars
# Edit .env.local and add your Supabase keys + Bun secret

# 5. Start both servers in two terminals
bun run dev
cd bun-server && bun run dev
```

Open `http://localhost:3000`.

## Docker (frontend + Bun server)
```bash
docker compose up --build
```

Services:
- Frontend: `http://localhost:3000`
- Bun server: `http://localhost:3001/health`
- Live browser (noVNC): `http://localhost:6080/vnc.html`

Optional env for Dockerized Bun server:
- `ADSPOWER_BASE_URL` (default: `http://host.docker.internal:50325`)
- `CORS_ALLOWED_ORIGINS` (default: `http://localhost:3000`)

## Workflow
1. Create/edit workflow nodes in Canvas.
2. Choose a LinkedIn profile from the dashboard top bar.
3. Upload a leads CSV in Leads.
4. Select pending leads and click `Run Workflow`.
5. Watch visible Chromium execute actions.
6. Monitor live logs in Logs.
7. Validate individual actions from Test.

## CSV Columns
- Required: `linkedin_url`
- Optional: `first_name`, `last_name`, `company`, `title`

## Notes
- This project has no billing/subscription logic.
- Keep usage moderate and respect platform terms/rate limits.

## Troubleshooting
- Browser does not open during test/run:
  - Start Bun server in an interactive terminal window:
    - `cd bun-server`
    - `bun run dev`
  - Avoid running Bun as a detached/background service if you need visible Chromium.
- Logs always empty or run state looks wrong:
  - Ensure your Supabase tables match this app schema exactly.
  - If your project already has conflicting `leads/workflows/execution_*` tables, run:
    - `supabase/migrations/002_reset_schema.sql`
