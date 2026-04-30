# Database Migrations

This folder contains versioned SQL migrations for the project. Going forward,
all schema changes go through this folder rather than `drizzle-kit push`
(decision 7A in `AUDIT_REPORT.md`).

## Workflow

### Generating a new migration from schema changes

After editing files in `src/schema/`, run:

```bash
pnpm --filter @workspace/db run generate
```

Drizzle-kit diffs your schema files against the journal in `meta/` and emits
a new SQL file (e.g. `0001_some_change.sql`).

**Always review the generated SQL** before committing. Drizzle's diff is
heuristic and can occasionally suggest destructive operations.

### Applying migrations

Local dev / staging:
```bash
pnpm --filter @workspace/db run migrate
```

Production (preferred — manual review, atomic with `BEGIN/COMMIT`):
```bash
psql "$DATABASE_URL" -f lib/db/migrations/0000_xxx.sql
```

### Migration safety rules

- **Additive only.** Never drop, rename, or change the type of an existing
  column in a single migration on a populated DB. Use a 3-step pattern (add
  new column → backfill → drop old column in a later release) if you must.
- **Wrap in BEGIN/COMMIT** so the migration applies atomically.
- **Use `IF NOT EXISTS` / `IF EXISTS`** so re-running the same migration
  doesn't fail.
- **Index creation on large tables** — consider `CREATE INDEX CONCURRENTLY`
  outside a transaction (Drizzle won't generate this automatically; edit by
  hand after generation).

## Files

| File | Purpose |
|------|---------|
| `0000_ads_strategy_bootstrap.sql` | Phase 1: extend `brands` table with `ads_context`, `service_radius_km`, `avg_ticket_size_eur`; create `ads_reports` table |
| `meta/` | Drizzle's journal + snapshot of schema state per migration |

## Why was this folder added?

The project previously used `drizzle-kit push`, which diffs the live DB
against the schema and applies changes immediately. That works for local dev
but is risky in production:

- No record of what changed when (no journal)
- No staged review of generated SQL before applying
- No rollback path

`generate` + `migrate` separates "decide what to change" from "apply it",
which is the safer pattern for shared/production databases.
