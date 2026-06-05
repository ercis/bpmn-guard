# BPMN Guard — Frontend

Next.js 16 / React 19 web UI for [BPMN Guard](../README.md). Renders BPMN diagrams with [`bpmn-js`](https://github.com/bpmn-io/bpmn-js) (NavigatedViewer) and overlays quality-check findings on the model.

## Quick start

The full stack is meant to be run via `docker compose up --build` from the repository root — see the [root README](../README.md) for the canonical instructions. For local frontend-only iteration:

```bash
cp .env.example .env   # defaults to NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
pnpm install
pnpm dev               # http://localhost:3000
```

The dev server proxies `/api/*` to `NEXT_PUBLIC_BACKEND_URL`; start the backend (or `docker compose up backend database`) before logging in.

## Auth

The app ships in **demo mode** with no real authentication — a shim in [`lib/demo.ts`](lib/demo.ts) always reports a fixed demo user as signed in. The login/sign-up/logout UI is present but performs no real work. To re-enable JWT auth, see the auth notes in the [root README](../README.md#auth-notes).

## Layout

- `app/` — Next.js App Router pages (dashboard, reports, models, analysis)
- `app/api/` — server-side proxy routes that forward to the FastAPI backend with the demo bearer token
- `app/dashboard/reports/[id]/_components/bpmn-visualisation.tsx` — the BPMN viewer + finding overlays
- `components/` — shared UI primitives (Radix UI + Tailwind)
- `lib/` — demo auth shim, formatting helpers
- `types/` — Zod schemas mirroring the backend response shapes
