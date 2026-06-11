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

For the runtime database (SQLite or PostgreSQL), use the checked-in helper script:

```bash
scripts/backup-db.sh
```

By default it writes to `backups/db-<timestamp>/`. To write outside the repository:

```bash
scripts/backup-db.sh /tmp/manga-cms-db-backup
```

This script automatically detects whether `DATABASE_URL` is pointing to SQLite or PostgreSQL and creates the appropriate backup (`dev.db.bak` or `db.dump`/`db.sql`).

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

### Database

For the runtime database, use the checked-in helper script:

```bash
# 1. Stop the API server

# 2. Restore the database
scripts/restore-db.sh backups/db-<timestamp>

# 3. Restart the API server
```

The script will automatically detect the database type from `DATABASE_URL` and restore the appropriate file from the backup directory.

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
# Run API smoke test
./scripts/smoke-test.sh

# Run Viewer smoke test
./scripts/smoke-test-viewer.sh

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
