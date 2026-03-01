# Deimos

Personal agentic AI framework. BYOK — connect your own API keys, run locally, own your data.

Multi-provider chat, persistent memory, background agents, cron jobs, and live connections to external services. No cloud account required.

**Stack:** Python FastAPI · Next.js 16 · React 19 · Tailwind 4 · Zustand · Turbo · pnpm

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Node** | 20+ | `brew install node` |
| **pnpm** | 10+ | `npm install -g pnpm` |
| **Python** | 3.11+ | `brew install python` |
| **Rust** | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Docker** | any | Only needed for Postgres — SQLite works out of the box |

---

## Quick Start

### With the CLI (recommended)

```bash
# 1. Install deps
pnpm install

# 2. Build and install the CLI
cargo install --path cli/deimos

# 3. First-time setup
deimos setup

# 4. Start
deimos start --frontend
```

Open **http://localhost:3000**

### Without the CLI

```bash
# Install deps
pnpm install

# Backend
cd services/backend
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
cp .env.example .env   # add your API keys

# Terminal 1 — backend (:8000)
PYTHONPATH=services/backend services/backend/.venv/bin/python -m backend

# Terminal 2 — frontend (:3000)
pnpm dev:web
```

---

## Configuration

Deimos is BYOK — your keys never leave your machine.

**Option A: Web UI**
Settings → Integrations → add keys for Anthropic, OpenAI, Google, etc.

**Option B: `.env`**
```bash
cp services/backend/.env.example services/backend/.env
```
```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...

# SQLite (default, no setup needed)
DATABASE_URL=sqlite:///deimos.db

# Postgres (optional, enables pgvector memory search)
# DATABASE_URL=postgresql://deimos:deimos@localhost:5433/deimos
```

---

## CLI Reference

```
deimos setup              First-time setup wizard
deimos start              Start backend daemon
deimos start --frontend   Start backend + Next.js frontend

deimos stop               Graceful shutdown
deimos kill               Force kill ports 8787, 3000, 3001

deimos status             Show running state + health
deimos logs               Tail backend log
deimos logs --frontend    Tail frontend log

deimos db up              Start Postgres (docker compose)
deimos db down            Stop Postgres
deimos db shell           Open psql shell
deimos db reset           Drop + recreate schema (destructive)

deimos update             Pull latest, reinstall deps + CLI
```

---

## Project Structure

```
apps/
  web/          Main app — chat, memory, connections, settings (:3000)
  www/          Marketing site (:3001)
  console/      Admin console
  desktop/      Tauri desktop app
  docs/         Documentation site

services/
  backend/      Python FastAPI daemon (:8000)
    backend/
      agent/          Agent loop, tools, memory, scheduler
      connections/    Telegram + Discord bot integrations
      routes/         REST API (chat, memory, providers, connections)
      db.py           SQLite + Postgres dual-driver

cli/
  deimos/       Rust CLI (`deimos` binary)
  code/         Code REPL

packages/
  ui/           Shared shadcn/ui component library
  types/        Shared TypeScript types
  config/       Shared configs (Biome, TypeScript, Tailwind)

infra/
  docker/       Docker Compose configs
  k8s/          Kubernetes manifests

docker-compose.yml   Postgres + pgvector for local dev (port 5433)
```

---

## Supported Providers

| Provider | Models |
|----------|--------|
| **Anthropic** | Claude Sonnet 4.6, Opus 4.6, Haiku 4.5 |
| **OpenAI** | GPT-4o, GPT-4o-mini, o3-mini |
| **Google** | Gemini 2.0 Flash, Gemini 1.5 Pro |
| **Mistral** | Mistral Large, Mistral Small |
| **Cohere** | Command R+ |
| **Ollama** | Any local model (no key required) |

---

## Troubleshooting

**Backend won't start**
```bash
deimos logs
# check services/backend/.env has DATABASE_URL and at least one provider key
```

**`deimos: command not found`**
```bash
export PATH="$HOME/.cargo/bin:$PATH"
# add to ~/.zshrc to persist
```

**Ghost processes after crash**
```bash
deimos kill
```

**Postgres won't start**
- Is Docker Desktop running?
- Port conflict: `lsof -ti:5433` — kill it, then `deimos db up`
- Or skip Postgres entirely — SQLite works with no setup

---

## Development

See [`.claude/WORKFLOW.md`](.claude/WORKFLOW.md) for the full dev workflow.

```bash
pnpm turbo lint       # Biome check all packages
pnpm turbo typecheck  # tsc --noEmit all packages
pnpm turbo build      # build everything
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org). Husky enforces format and runs Biome on staged files automatically.
