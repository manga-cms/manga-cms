# Production Postgres Prisma Migrations

This document defines the safe migration path from the current production
Postgres database, which was initialized with `prisma db push`, to Prisma
`migrate deploy`.

## Migration Layout

Do not share one Prisma `migrations/` directory between SQLite and Postgres.

Current layout:

```text
packages/db/prisma/schema.prisma
  SQLite schema for local development and current staging volume

packages/db/prisma/schema.postgres.prisma
  Postgres schema for production runtime state

packages/db/prisma/postgres/migrations/
  Postgres-only Prisma migrations
```

Prisma places `migrations/` next to the schema file passed to migration
commands. The package scripts therefore copy `schema.postgres.prisma` to the
ignored file `packages/db/prisma/postgres/schema.prisma` before running
Postgres migration commands. This keeps the committed Postgres migrations under
`packages/db/prisma/postgres/migrations/` and prevents them from mixing with a
future SQLite `packages/db/prisma/migrations/` directory.

The initial migration is:

```text
packages/db/prisma/postgres/migrations/20260606000000_init/migration.sql
```

It represents the current Postgres runtime-state schema. Existing production
databases that were created with `db:push:postgres` must baseline this
migration instead of applying it.

## Available Commands

Run these from the repository root:

```bash
pnpm --filter @manga/db db:generate:postgres
pnpm --filter @manga/db db:migrate:postgres -- --name <migration_name>
pnpm --filter @manga/db db:migrate:deploy:postgres
pnpm --filter @manga/db db:migrate:status:postgres
pnpm --filter @manga/db db:migrate:baseline:postgres
```

`db:migrate:postgres` is for local development or a disposable verification
database. Production uses `db:migrate:deploy:postgres`, but only after the
production database has been baselined.

## Existing Production DB Baseline

Use this sequence for an existing production database that was initialized by
`db:push:postgres`.

1. Freeze schema-changing deploys and keep `deploy/fly/Dockerfile.api` on
   `db:push:postgres` until the baseline is complete.

2. Take a production backup:

   ```bash
   mkdir -p backups
   pg_dump -Fc "$DATABASE_URL" > backups/prod-postgres-before-baseline-$(date +%Y%m%d-%H%M%S).dump
   ```

3. Confirm the production database matches the current Postgres schema. The
   expected output is `-- This is an empty migration.`. This command must not
   show destructive or schema-changing SQL. If it does, stop and reconcile the
   drift before continuing:

   ```bash
   cd packages/db
   pnpm exec prisma migrate diff \
     --from-url "$DATABASE_URL" \
     --to-schema-datamodel ./prisma/schema.postgres.prisma \
     --script
   cd ../..
   ```

4. Mark the initial migration as already applied. This records the baseline in
   `_prisma_migrations`; it must not create, drop, or alter application tables:

   ```bash
   DATABASE_URL="$DATABASE_URL" pnpm --filter @manga/db db:migrate:baseline:postgres
   ```

5. Confirm Prisma sees the database as up to date:

   ```bash
   DATABASE_URL="$DATABASE_URL" pnpm --filter @manga/db db:migrate:status:postgres
   ```

6. Only after the baseline is recorded and status is clean, switch production
   startup from `db:push:postgres` to `db:migrate:deploy:postgres` in a separate
   deploy change. Do not combine the first production baseline with the
   Dockerfile startup-command cutover.

## New Production DB

For a new empty production database, do not baseline. Generate the Postgres
client, then apply migrations:

```bash
pnpm --filter @manga/db db:generate:postgres
DATABASE_URL="<postgres-url>" pnpm --filter @manga/db db:migrate:deploy:postgres
```

## Local Verification

Use a disposable local Postgres database before changing production:

```bash
docker run --rm -d \
  --name manga-cms-prisma-postgres \
  -e POSTGRES_USER=manga \
  -e POSTGRES_PASSWORD=manga \
  -e POSTGRES_DB=manga_cms \
  -p 55432:5432 \
  postgres:16

export DATABASE_URL="postgresql://manga:manga@localhost:55432/manga_cms?schema=public"
pnpm --filter @manga/db db:migrate:deploy:postgres
pnpm --filter @manga/db db:migrate:status:postgres

docker rm -f manga-cms-prisma-postgres
```

## Future Migration Workflow

For a schema change that affects production runtime state:

1. Update `packages/db/prisma/schema.postgres.prisma`.
2. Keep `packages/db/prisma/schema.prisma` in sync when the same runtime model
   exists in SQLite.
3. Generate a Postgres migration against a local or disposable Postgres
   database:

   ```bash
   DATABASE_URL="<local-postgres-url>" pnpm --filter @manga/db db:migrate:postgres -- --name <migration_name>
   ```

4. Review and commit only the Postgres migration under
   `packages/db/prisma/postgres/migrations/`.
5. Verify:

   ```bash
   pnpm --filter @manga/db db:generate:postgres
   DATABASE_URL="<verification-postgres-url>" pnpm --filter @manga/db db:migrate:deploy:postgres
   pnpm --filter @manga/api build
   ```
