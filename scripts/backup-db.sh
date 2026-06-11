#!/usr/bin/env bash
set -euo pipefail

# Find project root
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TARGET_DIR="${1:-}"

if [ -z "$TARGET_DIR" ]; then
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    BACKUP_DIR="$ROOT_DIR/backups/db-$TIMESTAMP"
else
    if [[ "$TARGET_DIR" = /* ]]; then
        BACKUP_DIR="$TARGET_DIR"
    else
        BACKUP_DIR="$(pwd)/$TARGET_DIR"
    fi
fi

cd "$ROOT_DIR"

# Load environment variables (to get DATABASE_URL)
if [ -f ".env" ]; then
    set -a
    # shellcheck disable=SC1091
    source ".env"
    set +a
fi

DATABASE_URL=${DATABASE_URL:-}

echo "📦 Creating runtime DB backup at $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

if [ -z "$DATABASE_URL" ] || [[ "$DATABASE_URL" == file:* ]]; then
    # Default to SQLite
    if [ -f "packages/db/prisma/dev.db" ]; then
        cp packages/db/prisma/dev.db "$BACKUP_DIR/dev.db.bak"
        echo "  ✅ Backed up SQLite database (dev.db)"
    else
        echo "  ⚠️ No SQLite database found at packages/db/prisma/dev.db"
    fi
elif [[ "$DATABASE_URL" == postgresql://* ]] || [[ "$DATABASE_URL" == postgres://* ]]; then
    # PostgreSQL
    echo "  📦 Dumping PostgreSQL database..."
    if command -v pg_dump >/dev/null 2>&1; then
        pg_dump -Fc "$DATABASE_URL" > "$BACKUP_DIR/db.dump"
        pg_dump "$DATABASE_URL" > "$BACKUP_DIR/db.sql"
        echo "  ✅ Backed up PostgreSQL database (custom and plain SQL formats)"
    else
        echo "  ❌ Error: pg_dump command not found. Cannot backup PostgreSQL."
        exit 1
    fi
else
    echo "  ⚠️ Unknown DATABASE_URL format. Cannot backup."
fi

echo ""
echo "Backup complete: $BACKUP_DIR"
ls -lh "$BACKUP_DIR"
