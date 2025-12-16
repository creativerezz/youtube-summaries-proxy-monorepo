# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

```bash
# Install all dependencies (uses pnpm)
pnpm install

# Set up Python backend (one-time)
cd apps/api && python -m venv .venv && source .venv/bin/activate && pip install -e . && cd ../..

# Run all services
pnpm dev

# Run individual apps
pnpm dev:web     # Next.js → http://localhost:3000
pnpm dev:api     # FastAPI → http://localhost:8000
pnpm dev:worker  # Wrangler dev server
```

## Commands

```bash
# Build & test
pnpm build                    # Build all apps
pnpm test                     # Test all apps
pnpm test:api                 # Python tests only
pnpm lint                     # Lint all apps
pnpm typecheck                # Type check all apps
pnpm format                   # Format with Prettier

# App-specific (via Turborepo filters)
pnpm --filter @repo/web <script>
pnpm --filter @repo/api <script>
pnpm --filter @repo/worker <script>

# Python API (from apps/api with venv activated)
pytest -v                                          # All tests
pytest tests/test_unit.py::TestClass::test_name -v # Single test
ruff check app/ && ruff format app/ --check        # Lint
mypy app/ --ignore-missing-imports                 # Type check

# Worker (from apps/worker)
pnpm --filter @repo/worker deploy                  # Deploy to Cloudflare
wrangler d1 migrations apply DB --remote           # Run D1 migrations
```

## Architecture

```
┌─────────────────────┐
│  apps/web           │  Next.js 16 + React 19 frontend
│  (Vercel)           │  OpenRouter AI, Supabase auth, Polar payments
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  apps/worker        │  Cloudflare Worker edge cache
│  (Cloudflare)       │  Hono + chanfana, D1 database, KV cache
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  apps/api           │  FastAPI backend (Python)
│  (Railway)          │  YouTube transcript extraction, proxy support
└─────────────────────┘
```

## App Details

| App | Package Manager | Tech Stack |
|-----|-----------------|------------|
| **web** | pnpm | Next.js 16, React 19, Tailwind v4, shadcn/ui, Vercel AI SDK |
| **api** | pip (venv) | FastAPI, youtube-transcript-api, httpx |
| **worker** | pnpm | Hono, chanfana (OpenAPI), D1, KV, Vitest |

See app-specific CLAUDE.md files for detailed guidance:
- `apps/web/CLAUDE.md` - Frontend architecture, API routes, streaming patterns
- `apps/api/CLAUDE.md` - Route structure, proxy config, test fixtures

## Key URLs

| Environment | Web | API | Worker |
|-------------|-----|-----|--------|
| **Production** | youtubesummaries.cc | fetch.youtubesummaries.cc | youtube-transcript-storage.automatehub.workers.dev |
| **Local** | localhost:3000 | localhost:8000 | wrangler dev |

## Critical Notes

- **Proxy required**: YouTube blocks cloud IPs. The API needs `WEBSHARE_USERNAME`/`WEBSHARE_PASSWORD` for transcript endpoints on Railway
- **Monorepo**: Uses pnpm workspaces + Turborepo. Run commands from root
- **Python venv**: Always activate before running API commands: `source apps/api/.venv/bin/activate`
