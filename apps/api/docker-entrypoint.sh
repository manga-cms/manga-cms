#!/bin/sh
set -eu

mkdir -p \
  "${CONTENTS_DIR:-/data/contents}" \
  "${PACKS_DIR:-/data/packs}" \
  "${FEEDBACK_DIR:-/data/feedback}" \
  "${PROPOSALS_DIR:-/data/proposals}" \
  "${PACK_DRAFTS_DIR:-/data/pack-drafts}" \
  "${DRAFTS_DIR:-/data/drafts}" \
  "${IMPORTS_DIR:-/data/imports}" \
  "${DRAFT_ASSETS_DIR:-/data/draft-assets}" \
  "${RIGHTS_DIR:-/data/rights}" \
  "${ENTITLEMENTS_DIR:-/data/entitlements}" \
  "${GITHUB_HANDOFF_DIR:-/data/github-handoffs}" \
  "${GITHUB_IDENTITY_DIR:-/data/github-identities}"

if [ "${NODE_ENV:-development}" = "production" ]; then
  case "${DEV_AUTH_SECRET:-}" in
    ""|*change-me*)
      echo "DEV_AUTH_SECRET must be set to a unique production value" >&2
      exit 1
      ;;
  esac
  case "${DELIVERY_SECRET:-}" in
    ""|*change-me*)
      echo "DELIVERY_SECRET must be set to a unique production value" >&2
      exit 1
      ;;
  esac
fi

if [ "${PRISMA_PROVIDER:-postgresql}" = "postgresql" ]; then
  case "${DATABASE_URL:-}" in
    postgresql://*|postgres://*) ;;
    *)
      echo "DATABASE_URL must be a Postgres URL when PRISMA_PROVIDER=postgresql" >&2
      exit 1
      ;;
  esac

  attempt=1
  until pnpm --filter @manga/db db:push:postgres; do
    if [ "$attempt" -ge 30 ]; then
      echo "Prisma db:push failed after $attempt attempts" >&2
      exit 1
    fi
    attempt=$((attempt + 1))
    echo "Waiting for Postgres before Prisma db:push (attempt $attempt)..." >&2
    sleep 2
  done
else
  pnpm --filter @manga/db db:push:sqlite
fi

exec "$@"
