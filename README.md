# LinkedIn Automator (Localhost)

A personal-use LinkedIn outreach automation platform with a visual workflow builder, CSV lead imports, Playwright execution engine, and Supabase-backed realtime logs.

## Stack
- Next.js 14 (App Router), TailwindCSS, React Flow, Zustand
- Bun server + Playwright (visible Chromium)
- Supabase Postgres + Realtime

## Prerequisites
- Bun (latest)
- Node.js 18+
- Supabase CLI (for local-hosted Supabase)
- `psql` (or use Supabase Studio SQL editor)

## Setup
```bash
# 1. Install dependencies
bun install
cd bun-server && bun install && cd ..

# 2. Install Playwright browser
cd bun-server && bunx playwright install chromium && cd ..

# 3. Start local-hosted Supabase
supabase start

# 4. Initialize schema
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f supabase/schema/local_hosted_init.sql

# 5. Configure env vars
# Use local Supabase URL/keys in .env.local

# 6. Start both servers in two terminals
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

Optional env for Dockerized Bun server:
- `ADSPOWER_BASE_URL` (default: `http://host.docker.internal:50325`)
- `CORS_ALLOWED_ORIGINS` (default: `http://localhost:3000`)

Supabase URL in Docker:
- Keep `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` for the browser.
- Use `SUPABASE_URL=http://host.docker.internal:54321` for server-side container calls.

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
- Local Supabase defaults:
  - API URL: `http://127.0.0.1:54321`
  - DB URL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
  - Use keys from `supabase status` for `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.

## Troubleshooting
- Browser does not open during test/run:
  - Start Bun server in an interactive terminal window:
    - `cd bun-server`
    - `bun run dev`
  - Avoid running Bun as a detached/background service if you need visible Chromium.
  - In Docker, browser runs headless by default (`HEADLESS=true`) and does not open on your desktop.
    - Check backend health: `http://localhost:3001/health`
    - Ensure AdsPower endpoint is reachable from container (`ADSPOWER_BASE_URL`)
- Logs always empty or run state looks wrong:
  - Ensure your Supabase tables match this app schema exactly.
  - Reset and re-apply the consolidated init schema:
    - `supabase/schema/local_hosted_init.sql`
