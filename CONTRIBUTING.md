# Contributing - Running CI Locally

Commands to replicate GitHub Actions workflows locally (no cache, with dummy env vars).

---

## Codestyle (Linting and Formatting)

### Backend (Ruff)

**Check:**

```bash
cd backend
pip install ruff
ruff check --config pyproject.toml .
ruff format --config pyproject.toml --check
```

**Auto-fix:**

```bash
cd backend
ruff check --config pyproject.toml --fix .
ruff format --config pyproject.toml .
```

### Frontend (ESLint)

**Check:**

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm lint
```

**Auto-fix:**

```bash
cd frontend
pnpm lint --fix
```

---

## Type Check

### Backend (Pyright)

```bash
cd backend
uv sync
uv run pyright
```

### Backend (Deptry)

```bash
cd backend
uv sync
uv run deptry .
```

### Frontend (TypeScript)

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
```

---

## Build

### Backend (FastAPI)

**macOS/Linux:**

```bash
cd backend
uv sync

DEMO_MODE="True" \
SYNC_DATABASE_URI="postgresql://user:pass@localhost:5432/db" \
ASYNC_DATABASE_URI="postgresql+asyncpg://user:pass@localhost:5432/db" \
OPENAI_API_KEY="dummy-key" \
OPENAI_API_ENDPOINT="https://api.openai.com/v1" \
uv run python -c "from main import app; print('FastAPI app loaded successfully')"
```

**Windows (PowerShell):**

```
cd backend
uv sync

$env:DEMO_MODE="True"; `
$env:SYNC_DATABASE_URI="postgresql://user:pass@localhost:5432/db"; `
$env:ASYNC_DATABASE_URI="postgresql+asyncpg://user:pass@localhost:5432/db"; `
$env:OPENAI_API_KEY="dummy-key"; `
$env:OPENAI_API_ENDPOINT="https://api.openai.com/v1"; `
uv run python -c "from main import app; print('FastAPI app loaded successfully')"
```

### Frontend (Next.js)

**macOS/Linux:**

```bash
cd frontend
pnpm install --frozen-lockfile

NEXT_PUBLIC_BACKEND_URL="http://localhost:8000" \
pnpm build
```

**Windows (PowerShell):**

```
cd frontend
pnpm install --frozen-lockfile

$env:NEXT_PUBLIC_BACKEND_URL="http://localhost:8000"; `
pnpm build
```

---

## Requirements

- Python 3.12
- Node.js 22 (bpmnlint 11.x requires Node ≥ 20.17 for ESM interop)
- pnpm 10
