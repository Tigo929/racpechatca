# Target Architecture

## Decision

Keep the product as a modular monolith while its business model is still changing.
The current operational boundaries are enough: CRM API, frontend, Telegram greeter,
local code-agent worker, PostgreSQL, and deployment worker. Turning every feature
into a network service now would add failure modes without solving a measured scale
problem.

## Runtime Planes

1. **Transactional plane** - authenticated CRM API and PostgreSQL. It owns orders,
   tasks, users, permissions, and durable state transitions.
2. **Worker plane** - scheduled jobs, Telegram notifications, imports, and local code
   execution. Every job is persisted, idempotent, retryable, and observable.
3. **AI plane** - a narrow gateway contract for interactive AI plus the local code
   executor for repository work. AI never writes core records without validation.
4. **Presentation plane** - the React application, organized by business feature and
   consuming stable API contracts.

## Backend Module Shape

New or substantially revised business modules should converge on this structure:

```text
feature/
  api/             controllers and transport DTOs
  application/     use cases and public feature facade
  domain/          policies, value objects, state transitions
  infrastructure/  Prisma repositories and external adapters
  workers/         queue consumers and scheduled handlers
```

This is a direction, not a bulk rewrite. Move code only while delivering a feature
or fixing a defect. Keep one public facade per feature so dependencies remain visible.

## First Decomposition Targets

### Orders

`order-photo.service.ts` has accumulated creation, pricing, fulfillment, file, and
integration responsibilities. Extract use cases in this order:

1. pricing and total calculation policy;
2. order state transitions;
3. fulfillment/print orchestration;
4. external marketplace adapters;
5. Prisma order repository.

### Tasks And Agents

Treat local-agent execution as a durable task protocol:

- states: `OPEN -> IN_PROGRESS -> DONE | FAILED`, with stale recovery;
- atomic claim so only one worker receives a task;
- heartbeat and execution lease;
- bounded retries and a terminal failure reason;
- append-only execution events for user-visible progress;
- correlation ID shared by CRM, worker, and agent logs;
- workspace allowlist and command policy on the laptop.

The next evolution should add an execution table instead of overloading a task row:
`AgentExecution(id, taskId, agent, state, attempt, leaseUntil, startedAt, finishedAt,
summary, error, commitSha, logRef)`.

### Analytics

Analytics modules have broad database fan-out. Move repeated reads into named query
objects, add indexes from measured slow queries, and cache only stable aggregates.
Do not cache transactional order state.

### Frontend

Move toward feature folders (`orders`, `tasks`, `marketplace`, `analytics`,
`settings`) containing routes, API hooks, components, and tests. Shared UI should
contain presentation primitives only; business behavior stays in its feature.

## AI Contract

The CRM talks to one gateway interface regardless of the underlying provider. Each
request carries a request ID, user ID, timeout, and allowed capability list. The
gateway response is schema-validated and returns a concise answer plus diagnostics.

For code execution, the CRM stores the task and the laptop worker pulls it. The worker
runs Codex or Claude non-interactively, posts heartbeats, captures a bounded summary,
and reports the resulting commit SHA. API credentials are not required for Codex CLI
when the laptop is authenticated through the desktop account; the worker still needs
the CRM agent token.

## Delivery Contract

- CI builds and tests backend and frontend, audits production dependencies, and builds
  immutable images tagged with the Git SHA.
- Production switches to the new image, verifies health, and rolls back on failure.
- Database backups are written atomically, integrity-checked, and copied off-host.
- Containers have memory, process, and log rotation limits.
- Health reports deployment SHA and dependency readiness without exposing secrets.

## Migration Order

1. Stabilize CI, backups, rollback, and local-agent recovery.
2. Add durable agent executions and progress events.
3. Extract order pricing and status policies with tests.
4. Introduce repositories around high-churn Prisma queries.
5. Reorganize frontend code feature by feature.
6. Measure queue depth, response latency, database load, and failure rate.
7. Split a service only when those measurements show a concrete isolation or scaling
   need.
