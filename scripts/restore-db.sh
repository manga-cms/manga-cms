#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <backup-directory>"
    echo "Example: $0 backups/db-20260610-154200"
    exit 1
fi

TARGET_DIR="$1"

if [[ "$TARGET_DIR" = /* ]]; then
    BACKUP_DIR="$TARGET_DIR"
else
    BACKUP_DIR="$(pwd)/$TARGET_DIR"
fi

if [ ! -d "$BACKUP_DIR" ]; then
    echo "Error: Backup directory '$BACKUP_DIR' does not exist."
    exit 1
fi

# Find project root
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Load environment variables
if [ -f ".env" ]; then
    set -a
    # shellcheck disable=SC1091
    source ".env"
    set +a
fi

DATABASE_URL=${DATABASE_URL:-}

echo "⚠️  WARNING: This will overwrite your current runtime database state."
echo "Press Ctrl+C to cancel, or Enter to continue..."
read -r

echo "📦 Restoring DB from $BACKUP_DIR"

if [ -z "$DATABASE_URL" ] || [[ "$DATABASE_URL" == file:* ]]; then
    # Default to SQLite
    if [ -f "$BACKUP_DIR/dev.db.bak" ]; then
        cp "$BACKUP_DIR/dev.db.bak" packages/db/prisma/dev.db
        echo "  ✅ Restored SQLite database to packages/db/prisma/dev.db"
    else
        echo "  ❌ Error: dev.db.bak not found in $BACKUP_DIR"
        exit 1
    fi
elif [[ "$DATABASE_URL" == postgresql://* ]] || [[ "$DATABASE_URL" == postgres://* ]]; then
    # PostgreSQL
    if [ -f "$BACKUP_DIR/db.dump" ]; then
        if command -v pg_restore >/dev/null 2>&1; then
            echo "  📦 Dropping existing schema..."
            psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
            echo "  📦 Restoring from dump..."
            pg_restore -d "$DATABASE_URL" "$BACKUP_DIR/db.dump"
            echo "  ✅ Restored PostgreSQL database"
        else
            echo "  ❌ Error: pg_restore command not found."
            exit 1
        fi
    elif [ -f "$BACKUP_DIR/db.sql" ]; then
        if command -v psql >/dev/null 2>&1; then
            echo "  📦 Dropping existing schema..."
            psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
            echo "  📦 Restoring from SQL..."
            psql "$DATABASE_URL" < "$BACKUP_DIR/db.sql"
            echo "  ✅ Restored PostgreSQL database"
        else
            echo "  ❌ Error: psql command not found."
            exit 1
        fi
    else
        echo "  ❌ Error: Neither db.dump nor db.sql found in $BACKUP_DIR"
        exit 1
    fi
else
    echo "  ⚠️ Unknown DATABASE_URL format. Cannot restore."
    exit 1
fi

echo ""
echo "✅ DB Restore complete. Please restart the API server."
