# Changelog

All notable changes to Deimos will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Multi-provider AI chat (Anthropic, OpenAI, Google, Mistral, Cohere)
- Ghost mode — ephemeral off-the-record chat sessions per palette theme
- Connections dock — live-status sidebar for MCP/API connections
- Cron jobs panel in sidebar
- Settings and connections management pages
- SQLite backend (no Docker required for local dev) with asyncpg Postgres fallback
- `deimos` CLI — `setup`, `start`, `start --frontend` commands
- Memory system with pin/search/delete (pgvector on Postgres, recency fallback on SQLite)
- Mars, DeepSpace, and Phobos color palettes with dark/light variants
- Turbo monorepo: `apps/web`, `apps/www`, `services/backend`, `cli/deimos`

---

## [0.1.0] — 2025-01-01

- Initial private release
