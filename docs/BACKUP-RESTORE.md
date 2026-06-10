# Backup and Restore

Manga content and runtime state are separate backup domains.

- `contents/` is the canonical editorial source of truth for Series, Episode,
  Page, Panel, and Bubble data.
- `packs/` is the canonical source for Pack manifests.
- The database stores runtime state such as entitlements, purchases, tokens,
  ingestion jobs, sessions, audit records, and other operational data.
- Restoring the database must not be treated as restoring canonical manga
  content. Restoring manga content requires restoring `contents/` and, when
  applicable, `packs/`.

## What to Back Up

| Component | Location | Notes |
|-----------|----------|-------|
| Database | `DATABASE_URL` target | Runtime state: entitlements, purchases, tokens, ingestion jobs, sessions, audit records |
| Content | `contents/` directory | Canonical source of truth for manga data |
| Packs | `packs/` directory | Canonical Pack manifests |
| Drafts | `drafts/` directory | In-progress ingestion drafts |
| Environment | `.env` file | Secrets and configuration |

## Database Backup

### SQLite

```bash
# Copy the database file
cp packages/db/prisma/dev.db backups/db-$(date +%Y%m%d-%H%M%S).db
```

### PostgreSQL

```bash
# Dump the database
pg_dump "$DATABASE_URL" > backups/db-$(date +%Y%m%d-%H%M%S).sql

# Or binary format (faster restore)
pg_dump -Fc "$DATABASE_URL" > backups/db-$(date +%Y%m%d-%H%M%S).dump
```

## Content Backup

For the canonical manga content source only, use the checked-in helper script:

```bash
scripts/backup-contents.sh
```

By default it writes to `backups/contents-<timestamp>/`, which is ignored by
Git. To write outside the repository:

```bash
scripts/backup-contents.sh /tmp/manga-cms-content-backup
```

This script backs up `contents/` and `packs/`. It does not back up the runtime
database, private drafts, local samples, or environment secrets.

```bash
# Archive contents directory
tar czf backups/contents-$(date +%Y%m%d-%H%M%S).tar.gz contents/

# Archive drafts if any exist
[ -d drafts ] && tar czf backups/drafts-$(date +%Y%m%d-%H%M%S).tar.gz drafts/
```

## Full Backup Script

```bash
#!/usr/bin/env bash
# scripts/backup.sh
set -euo pipefail

BACKUP_DIR="backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 Starting backup to $BACKUP_DIR"

# 1. Database
if [ -f packages/db/prisma/dev.db ]; then
    cp packages/db/prisma/dev.db "$BACKUP_DIR/db.sqlite"
    echo "  ✅ SQLite database"
fi

# 2. Content
tar czf "$BACKUP_DIR/contents.tar.gz" contents/
echo "  ✅ Contents"

# 2b. Packs
if [ -d packs ] && [ "$(ls -A packs 2>/dev/null)" ]; then
    tar czf "$BACKUP_DIR/packs.tar.gz" packs/
    echo "  ✅ Packs"
fi

# 3. Drafts
if [ -d drafts ] && [ "$(ls -A drafts 2>/dev/null)" ]; then
    tar czf "$BACKUP_DIR/drafts.tar.gz" drafts/
    echo "  ✅ Drafts"
fi

# 4. Environment (exclude secrets from comments, keep values)
cp .env "$BACKUP_DIR/env.bak"
echo "  ✅ Environment"

echo ""
echo "Backup complete: $BACKUP_DIR"
ls -lh "$BACKUP_DIR"
```

## Restore

### SQLite

```bash
# 1. Stop the API server

# 2. Replace the database file
cp backups/<timestamp>/db.sqlite packages/db/prisma/dev.db

# 3. Restart the API server
```

### PostgreSQL

```bash
# 1. Stop the API server

# 2. Drop and recreate the database
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 3. Restore from dump
pg_restore -d "$DATABASE_URL" backups/<timestamp>/db.dump
# Or from SQL:
psql "$DATABASE_URL" < backups/<timestamp>/db.sql

# 4. Restart the API server
```

### Content

For the canonical manga content source only, use:

```bash
scripts/restore-contents.sh backups/contents-<timestamp>
```

The script prompts before replacing `contents/` and `packs/`. It does not
restore runtime DB state.

```bash
# 1. Stop the API server (optional but recommended)

# 2. Restore contents
rm -rf contents/
tar xzf backups/<timestamp>/contents.tar.gz

# 3. Restore packs if a packs backup exists
if [ -f backups/<timestamp>/packs.tar.gz ]; then
  rm -rf packs/
  tar xzf backups/<timestamp>/packs.tar.gz
fi

# 4. Restart the API server (caches will rebuild)
```

## Verification After Restore

```bash
# Run smoke test
./scripts/smoke-test.sh

# Or manual checks:
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/series
```

## Backup Schedule Recommendation

| Frequency | What |
|-----------|------|
| Daily | Database |
| On publish | `contents/` snapshot |
| Weekly | Full backup (DB + contents + drafts) |
