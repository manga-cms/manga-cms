# Backup and Restore

## What to Back Up

| Component | Location | Notes |
|-----------|----------|-------|
| Database | `DATABASE_URL` target | All entitlements, purchases, tokens, ingestion jobs |
| Content | `contents/` directory | Source of truth for manga data |
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

```bash
# 1. Stop the API server (optional but recommended)

# 2. Restore contents
rm -rf contents/
tar xzf backups/<timestamp>/contents.tar.gz

# 3. Restart the API server (caches will rebuild)
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
