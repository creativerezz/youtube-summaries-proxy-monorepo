# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this Turborepo monorepo.

## Repository Structure

```
youtube-summaries/
├── apps/
│   ├── web/           # Next.js frontend (Vercel)
│   ├── api/           # FastAPI backend (Railway)
│   └── worker/        # Cloudflare Worker (D1 edge cache)
├── transcripts/       # YouTube transcript markdown files
├── turbo.json         # Turborepo configuration
└── pnpm-workspace.yaml
```

## Quick Start

```bash
# Install all dependencies
pnpm install

# Set up Python virtual environment (one-time)
cd apps/api && python -m venv .venv && source .venv/bin/activate && pip install -e . && cd ../..

# Run all services in development
pnpm dev

# Run specific app
pnpm dev:web     # Next.js on http://localhost:3000
pnpm dev:api     # FastAPI on http://localhost:8000
pnpm dev:worker  # Wrangler dev server

# Build all
pnpm build

# Test all
pnpm test

# Lint all
pnpm lint
```

## App-Specific Guidance

See individual CLAUDE.md files:
- `apps/web/CLAUDE.md` - Next.js frontend details
- `apps/api/CLAUDE.md` - FastAPI backend details

## Package Manager

This monorepo uses **pnpm** (not npm, yarn, or bun).

```bash
# Root commands
pnpm <script>

# App-specific
pnpm --filter @repo/web <script>
pnpm --filter @repo/api <script>
pnpm --filter @repo/worker <script>

# Turbo tasks
pnpm turbo run <task> --filter=@repo/<app>
```

## Data Flow

```
Next.js App (apps/web)
    ↓
Cloudflare Worker (apps/worker) - edge cache layer
    ↓
FastAPI Server (apps/api) → YouTube APIs
```

## Deployment

| App | Platform | Notes |
|-----|----------|-------|
| web | Vercel | Set Root Directory to `apps/web` |
| api | Railway | Set Root Directory to `apps/api` |
| worker | Cloudflare | `pnpm --filter @repo/worker deploy` |
