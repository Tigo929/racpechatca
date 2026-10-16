# Repository Guide

This repository is a modular CRM monolith with a React frontend and a small set of
separate runtime workers. Keep changes inside the owning feature whenever possible.

## Workspace Map

- `crm-new/` - NestJS API, Prisma schema, scheduled jobs, and business modules.
- `frontend/` - React/Vite CRM application.
- `crm-mcp/` - MCP integration used by external assistants.
- `greeter/` - Telegram notification service.
- `local-agent/` - laptop worker that claims CRM tasks and invokes Codex or Claude.
- `deploy/` - production update and recovery scripts.
- `docs/` - operational and architecture documentation.
- `docker-compose.prod.yml` - production topology and resource limits.

## Commands

Run commands from the relevant package directory.

```bash
# Backend
cd crm-new
npm ci
npm run build
npm test -- --runInBand
npm run lint:check

# Frontend
cd frontend
npm ci
npm run build
npm test
npm run lint

# Local task worker
cd local-agent
node --check dispatcher.mjs
node dispatcher.mjs --once
```

Backend lint currently includes legacy violations. Do not expand the lint debt in
files you touch; use build and focused tests as the minimum backend gate until the
baseline is cleaned up.

## Architecture Rules

- Keep the CRM as a modular monolith. Split deployment units only when independent
  scaling, isolation, or ownership is demonstrated by production data.
- Controllers handle transport and validation. Application services coordinate use
  cases. Domain code owns business rules. Infrastructure code owns Prisma and remote
  integrations.
- Do not import another feature's controller, DTO implementation, or Prisma query.
  Expose an application service or a small public contract instead.
- Keep long-running work out of HTTP requests. Persist a job/task first, then process
  it in a worker with retries, heartbeats, idempotency, and an audit trail.
- Never trust client-computed prices, totals, statuses, permissions, or assignees.
- Do not edit generated Prisma files. Schema changes require a migration and a
  compatibility plan for the currently deployed application.
- External AI output is untrusted input. Validate its shape, cap execution time and
  output size, and never expose credentials in prompts, logs, or task summaries.
- The local code agent may edit only an explicitly configured workspace. It must not
  deploy automatically unless a later policy adds tests, review, and rollback gates.

## Verification

- Add focused tests for changed behavior and regression tests for fixed defects.
- Run package builds and tests before pushing.
- For deployment changes, validate shell syntax and `docker compose config`.
- Preserve unrelated local changes and never rewrite production history.
- Confirm `/health` after deployment and compare its commit SHA with the pushed SHA.

See `docs/ARCHITECTURE_TARGET.md` for the target module layout and migration order.
