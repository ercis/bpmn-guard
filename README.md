# BPMN Guard — Automated Quality Checks for BPMN Models

## Application Startup

The app ships in **demo mode**: a single fixed user, files on the local filesystem, no external accounts. The only secret you need is an OpenAI-compatible API key for the LLM-powered checks (semantic labels, duplicates, chat). The bundled Postgres-with-pgvector container is started automatically.

### 1. Configure the LLM key

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and set OPENAI_API_KEY (any OpenAI-compatible key works with the default endpoint).
```

The other variables already have sensible defaults; database URIs and the storage path are injected by docker-compose. Set `VECTOR_DB_INIT = True` on the first boot to seed the duplicate-check vector store from `bpmn_examples/`, then flip it back to `False` for faster subsequent restarts.

### 2. Start everything with Docker

```bash
docker compose up --build
```

This brings up:
- **frontend** on http://localhost:3000 (Next.js)
- **backend** on http://localhost:8000 (FastAPI; OpenAPI at `/docs`)
- **database** on `localhost:8080` (Postgres 17 + pgvector)

Open http://localhost:3000 — you're "signed in" as the demo user automatically. Uploaded `.bpmn` files persist in the `uploads` Docker volume; application data persists in the `pgdata` volume.

If you don't have a Docker runtime installed, on macOS `brew install --cask orbstack` is a lightweight option.

### 3. (Optional) Run without Docker, against the Dockerized Postgres

Useful for fast backend iteration with IDE debugging. Bring up only the database container, then run each service natively.

**Database**
```bash
docker compose up database
```

**Backend**
```bash
cd backend
# Set ASYNC_DATABASE_URI and SYNC_DATABASE_URI in .env, e.g.:
#   ASYNC_DATABASE_URI = "postgresql+asyncpg://testuser:testpw@localhost:8080/bpmn_guard"
#   SYNC_DATABASE_URI  = "postgresql+psycopg://testuser:testpw@localhost:8080/bpmn_guard"
uv sync --dev
uv run main.py
```

**Frontend**
```bash
cd frontend
cp .env.example .env   # defaults to NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
pnpm install
pnpm dev
```

### Auth notes

There is no real auth in demo mode — the backend's `get_current_user` returns a fixed identity (`DEMO_USER_ID`), and the frontend uses a demo shim in [`frontend/lib/demo.ts`](frontend/lib/demo.ts) that always reports the demo user as signed in. The auth UI (login/sign-up/logout) is present but performs no real work. To re-enable JWT-verified multi-user auth, set `DEMO_MODE=False` and `JWT_SECRET=<strong-secret>` in `backend/.env`, then wire the frontend shim to any auth provider that mints HS256 tokens.


## Contributing Guidelines

### Setup pre-commit
Pre-commit automatically checks your commited files with specified tools and therefore automatically enforces a coding standard. If uv is installed type `uvx` before the following commands to enable the hooks (*recommended*) or [install pre-commit](https://pre-commit.com/#install):
1. `pre-commit install`
2. `pre-commit install --hook-type commit-msg` to install commitlinter

#### About commit-lint
This pre-commit hook enforces commit messages to the standard of conventiontional commit messages and is based on the JS tool [commitlint](https://github.com/conventional-changelog/commitlint/#what-is-commitlint). You can find a [cheatsheet](https://gist.github.com/qoomon/5dfcdf8eec66a051ecd85625518cfd13) on how to write those.


### Branch Naming Convention

All branch names should follow this structure:

```
<scope>/<type>/<description>
```

#### Scope
- `frontend/` - For frontend-related changes
- `backend/` - For backend-related changes

#### Type
- `feature` - New features or enhancements
- `bug` - Bug fixes
- `chore` - Maintenance tasks, refactoring, dependency updates, etc.

#### Description
- Use lowercase letters
- Use '-' to separate words
- Be descriptive

#### Examples

```
frontend/feature/user-authentication
frontend/bug/login-form-validation
frontend/chore/update-dependencies

backend/feature/payment-integration
backend/bug/fix-database-connection
backend/chore/refactor-api-routes
```


## License

BPMN Guard's source code is licensed under the **MIT License** (see [`LICENSE`](LICENSE)).

Two directories contain **third-party data under the GNU General Public License v3.0 (GPL-3.0)**, which is *not* covered by the MIT license:

- [`bpmn_examples/CoherenceCheckingDataset/`](bpmn_examples/CoherenceCheckingDataset/) — a copy of the viadee [*Process-Document Coherence-Checking Dataset*](https://github.com/viadee/process-document-coherence-checking-dataset), used to seed the duplicate-check vector store.
- [`backend/tests/resources/duplicate_check/`](backend/tests/resources/duplicate_check/) — the subset of those models (plus anonymized variants) used by the duplicate-check integration test.

Those data files keep their GPL-3.0 license; bundling them alongside the MIT-licensed code is *mere aggregation* (GPLv3 §5) and does not affect the license of the code. Each of those directories carries its own license/notice.
