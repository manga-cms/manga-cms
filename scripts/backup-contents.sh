#!/usr/bin/env bash
set -euo pipefail

# Find project root
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Capture original path for absolute resolution if needed
TARGET_DIR="${1:-}"

if [ -z "$TARGET_DIR" ]; then
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    BACKUP_DIR="$ROOT_DIR/backups/contents-$TIMESTAMP"
else
    # If absolute path, use it. Otherwise, relative to current dir.
    if [[ "$TARGET_DIR" = /* ]]; then
        BACKUP_DIR="$TARGET_DIR"
    else
        BACKUP_DIR="$(pwd)/$TARGET_DIR"
    fi
fi

cd "$ROOT_DIR"

echo "Creating contents backup at $BACKUP_DIR"

mkdir -p "$BACKUP_DIR"

if [ -d "contents" ]; then
    tar -czf "$BACKUP_DIR/contents.tar.gz" contents/
    echo "  Backed up contents/"
else
    echo "  No contents/ directory found"
fi

if [ -d "packs" ] && [ "$(ls -A packs 2>/dev/null)" ]; then
    tar -czf "$BACKUP_DIR/packs.tar.gz" packs/
    echo "  Backed up packs/"
fi

echo ""
echo "Backup complete: $BACKUP_DIR"
ls -lh "$BACKUP_DIR"
