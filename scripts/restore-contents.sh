#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <backup-directory>"
    echo "Example: $0 backups/contents-20260610-154200"
    exit 1
fi

TARGET_DIR="$1"

# Resolve the absolute path of the backup directory before cd'ing
if [[ "$TARGET_DIR" = /* ]]; then
    BACKUP_DIR="$TARGET_DIR"
else
    BACKUP_DIR="$(pwd)/$TARGET_DIR"
fi

if [ ! -d "$BACKUP_DIR" ]; then
    echo "Error: Backup directory '$BACKUP_DIR' does not exist."
    exit 1
fi

if [ ! -f "$BACKUP_DIR/contents.tar.gz" ]; then
    echo "Error: contents.tar.gz not found in $BACKUP_DIR"
    exit 1
fi

# Find project root
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "WARNING: This will completely replace your current contents/ and packs/ directories."
echo "Press Ctrl+C to cancel, or Enter to continue..."
read -r

echo "Restoring from $BACKUP_DIR"

if [ -d "contents" ]; then
    echo "  Removing existing contents/"
    rm -rf contents/
fi

echo "  Extracting contents/"
tar -xzf "$BACKUP_DIR/contents.tar.gz"

if [ -f "$BACKUP_DIR/packs.tar.gz" ]; then
    if [ -d "packs" ]; then
        echo "  Removing existing packs/"
        rm -rf packs/
    fi
    echo "  Extracting packs/"
    tar -xzf "$BACKUP_DIR/packs.tar.gz"
fi

echo ""
echo "Restore complete."
