# Open Notebook — Agent Rules

Open Notebook is an open-source, privacy-focused alternative to Google's Notebook LM: an AI-powered research assistant with multi-provider AI support, fully self-hostable.

This file holds the project-wide rules every coding session needs. Component rules: [open_notebook/AGENTS.md](open_notebook/AGENTS.md) (backend — also covers `api/`, `commands/`, `prompts/`) and [frontend/AGENTS.md](frontend/AGENTS.md). Knowledge lives in the docs (see [Where to look](#where-to-look)) — read it on demand instead of guessing.

## Deployment

Two local modes: **development** (from source) and **production** (Docker Compose).

### Local development (from source)

Three tiers: Next.js frontend (3000) → FastAPI (5055) → SurrealDB (8000).

Start in this order — each tier depends on the one below:

1. `make database` — SurrealDB (API fails without it)
2. `make api` — FastAPI; **schema migrations run automatically on startup** (check logs)
3. `make worker-start` — surreal-commands worker. **Required**: podcasts, embeddings and source processing are async jobs that silently queue forever without it
4. `make frontend` — UI (depends on the API for all data)

Or all at once: `make start-all` (status: `make status`, stop: `make stop-all`).

- Frontend: http://localhost:3000
- API: http://localhost:5055 (docs: http://localhost:5055/docs)

### Local production (Docker Compose)

Uses `compose.production.yml`:

- `surrealdb`: SurrealDB database
- `open-notebook`: Includes the Next.js frontend, FastAPI, and background worker
- Frontend port: `127.0.0.1:8502`
- Application data: `./notebook_data`
- Database data: `./surreal-data`

The API automatically runs pending database migrations when the application
container starts.

#### Upgrade after code changes

After modifying code, rebuild and recreate only the application service. Keep
the database and data directories unchanged:

```bash
docker compose -f compose.production.yml stop open-notebook
docker compose -f compose.production.yml build open-notebook
docker compose -f compose.production.yml up -d --no-build --force-recreate open-notebook
```

Preserve `.env`, `OPEN_NOTEBOOK_ENCRYPTION_KEY`, `./surreal-data`, and
`./notebook_data` during upgrades.

#### Minimal deployment for partial changes

- Frontend, backend, worker, prompt, dependency, or Docker configuration
  changes: rebuild and recreate `open-notebook`.
- Application environment-only changes: recreate `open-notebook`; no rebuild is
  required.
- Documentation-only changes: no deployment is required.
- SurrealDB configuration or version changes: recreate only `surrealdb`, while
  preserving its data directory.

## Commands

- Tests: `uv run pytest tests/`
- Python lint/typecheck: `ruff check . --fix` · `uv run python -m mypy .`
- Frontend (inside `frontend/`): `npm run lint` · `npm run test` · `npm run build`
- Docker release: `make docker-release` (see `.github/RELEASE_PROCESS.md`)

### Low-memory validation and deployment

- Run frontend validation commands sequentially. Do not start `npm run lint`, `npx tsc --noEmit`, Vitest, and `npm run build` concurrently; parallel Node processes can exhaust a 2.4 GiB host and leave slow or killed processes behind.
- In constrained environments, run Vitest with one worker: `npm run test -- --pool=threads --maxWorkers=1`.
- Before rebuilding the production image, stop the existing Open Notebook application container while keeping the SurrealDB container and its data volumes running. Build with `docker compose --progress plain -f compose.production.yml build open-notebook`, then recreate only the application service with `docker compose -f compose.production.yml up -d --no-build --force-recreate open-notebook`.
- Allow extra time for a cold Docker build. The Next.js TypeScript phase is memory-sensitive; check `free -h` and `swapon --show` if a build appears hung, and avoid retrying while an earlier `tsc`, `next build`, or Vitest process is still running.

## Hard rules

- **Async-first**: every DB query, graph invocation and AI call is `await`-ed. No sync DB access.
- **Never commit secrets.** Credentials are encrypted at rest and require `OPEN_NOTEBOOK_ENCRYPTION_KEY` to be set.
- CORS is wide-open and auth is a simple password middleware — **dev defaults, not production hardening**. Don't build features that assume otherwise.
- Product direction questions (does this feature fit?) → [VISION.md](VISION.md). Past decisions ("why is it like this?") → [docs/7-DEVELOPMENT/decisions/](docs/7-DEVELOPMENT/decisions/). Structural decisions made while coding should produce a new decision record there.

## Where to look

| Need | Location |
|---|---|
| Architecture (3 tiers, workflows, data model) | [docs/7-DEVELOPMENT/architecture.md](docs/7-DEVELOPMENT/architecture.md) |
| Step-by-step recipes (add endpoint, migration, i18n…) | [docs/7-DEVELOPMENT/change-playbooks.md](docs/7-DEVELOPMENT/change-playbooks.md) |
| Dev environment setup | [docs/7-DEVELOPMENT/development-setup.md](docs/7-DEVELOPMENT/development-setup.md) |
| Code standards & testing | [docs/7-DEVELOPMENT/code-standards.md](docs/7-DEVELOPMENT/code-standards.md) · [testing.md](docs/7-DEVELOPMENT/testing.md) |
| Product identity & current posture | [VISION.md](VISION.md) |
| Decision log (ADRs/PDRs) | [docs/7-DEVELOPMENT/decisions/](docs/7-DEVELOPMENT/decisions/) |
| Contribution process (Discussions → Issues → PRs) | [docs/7-DEVELOPMENT/contributing.md](docs/7-DEVELOPMENT/contributing.md) |
| User/operator docs (install, configure, troubleshoot) | [docs/](docs/index.md) |

## Context Engine (CCE)

This project uses Code Context Engine for intelligent code retrieval and
cross-session memory.

### Searching the codebase

**Use `context_search` instead of reading files directly** when exploring
the codebase, answering questions about code, or understanding how things
work. `context_search` returns the most relevant code chunks with
confidence scores instead of whole files.

When to use `context_search`:
- Answering questions about the codebase ("how does X work?", "where is Y?")
- Exploring structure or architecture
- Finding related code, functions, or patterns

Other tools:
- `expand_chunk` for full source of a compressed result
- `related_context` for what calls/imports a function
- `session_recall` to recall past decisions

### Cross-session memory

Call `session_recall("topic phrase")` before answering non-trivial questions.
Call `record_decision(decision="...", reason="...")` after making choices.
Call `record_code_area(file_path="...", description="...")` after meaningful work.

### Output style

Respond in compressed style. Drop articles (a, an, the) in prose. Use
sentence fragments over full sentences. Use short synonyms (fix not resolve,
check not investigate). Pattern: [thing] [action] [reason]. [next step].
No filler, hedging, pleasantries, trailing summaries, or restating what
the user said. One sentence if one sentence is enough.

When suggesting code changes, show only the changed lines with 3 lines of
context. Never rewrite entire files. Multiple changes in one file: show each
change separately. Never echo back unchanged code the user already has.

Code blocks, file paths, commands, error messages: always written in full.
Security warnings and destructive action confirmations: use full clarity.
