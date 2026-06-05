# Use a Python image with uv pre-installed
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

# Install Node.js 22 + npm. bpmnlint 11.x transitively requires min-dash 5 (ESM-only),
# which Node 18 (Debian bookworm default) cannot `require()`. Node 20.17+ / 22 supports it.
RUN apt-get update && apt-get install -y curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Setup a non-root user
RUN groupadd --system --gid 999 nonroot \
 && useradd --system --gid 999 --uid 999 --create-home nonroot

# Install the project into `/app`
WORKDIR /app

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1

# Copy from the cache instead of linking since it's a mounted volume
ENV UV_LINK_MODE=copy

# Ensure installed tools can be executed out of the box
ENV UV_TOOL_BIN_DIR=/usr/local/bin

# Install the project's dependencies using the lockfile and settings
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project --no-dev

# Then, add the rest of the project source code and install it.
# --chown is needed because the source files on the host may be mode 700, which would
# leave the runtime non-root user unable to read them once COPY preserves perms.
COPY --chown=nonroot:nonroot . /app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev

# Install bpmnlint dependencies
RUN npm install --prefix /app/app/external/bpmn_lint

# Pre-create the uploads dir owned by the runtime user so the docker-compose named
# volume inherits that ownership on first mount (otherwise it lands root-owned 755).
RUN mkdir -p /app/uploads && chown -R nonroot:nonroot /app/uploads /app/.venv

# Place executables in the environment at the front of the path
ENV PATH="/app/.venv/bin:$PATH"

# Reset the entrypoint, don't invoke `uv`
ENTRYPOINT []

# Use the non-root user to run our application
USER nonroot

# Production: Use Gunicorn with Uvicorn workers
CMD ["gunicorn", "-c", "gunicorn.conf.py", "main:app"]
