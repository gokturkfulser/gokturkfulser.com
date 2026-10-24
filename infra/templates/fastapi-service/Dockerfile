# syntax=docker/dockerfile:1

# Varsayılan slim (glibc, ~205 MB). Daha küçük image (~101 MB) için: --build-arg PYTHON_IMAGE=python:3.14-alpine
# (musl: bağımlılıkların musllinux wheel'i olmalı; bkz. README > Image).
ARG PYTHON_IMAGE=python:3.14-slim-trixie

FROM ghcr.io/astral-sh/uv:0.13.5 AS uv

# --- builder: bağımlılıkları kilit dosyasından kurar ---
FROM ${PYTHON_IMAGE} AS builder
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv
WORKDIR /src
COPY pyproject.toml uv.lock .python-version ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev

# --- runtime: yalnızca .venv + uygulama, root olmayan kullanıcı ---
FROM ${PYTHON_IMAGE} AS runtime
ARG APP_VERSION=dev
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    VERSION=${APP_VERSION}
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY app ./app
# Sayısal uid: passwd kaydı gerekmez (slim ve alpine tabanlarında aynı çalışır).
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["python", "-m", "app.healthcheck"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-server-header"]
