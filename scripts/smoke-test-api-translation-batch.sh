#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/manga-api-translation-batch.XXXXXX")"
API_LOG="$TMP_DIR/api.log"
COOKIE_JAR="$TMP_DIR/cookies.txt"

PORT="${PORT:-$(node -e 'const net=require("node:net"); const server=net.createServer(); server.listen(0, () => { console.log(server.address().port); server.close(); });')}"
API="http://127.0.0.1:${PORT}/api/v1"
API_PID=""

cleanup() {
    local exit_code=$?
    if [ -n "${API_PID:-}" ] && kill -0 "$API_PID" >/dev/null 2>&1; then
        kill "$API_PID" >/dev/null 2>&1 || true
        wait "$API_PID" >/dev/null 2>&1 || true
    fi
    if [ "$exit_code" -ne 0 ]; then
        echo ""
        echo "---- API log ----"
        if [ -f "$API_LOG" ]; then
            cat "$API_LOG"
        else
            echo "No API log found."
        fi
        echo "-----------------"
    fi
    rm -rf "$TMP_DIR"
}
trap cleanup EXIT

fail() {
    echo "❌ $*" >&2
    exit 1
}

assert_json_equals() {
    local json="$1"
    local expression="$2"
    local expected="$3"
    node -e '
const data = JSON.parse(process.argv[1]);
const expression = process.argv[2];
const expected = process.argv[3];
const actual = Function("data", `return ${expression}`)(data);
if (String(actual) !== expected) {
  console.error(`Expected ${expression} to equal ${expected}, got ${String(actual)}`);
  process.exit(1);
}
' "$json" "$expression" "$expected"
}

echo "Starting API on ${API}"
(
    cd "$ROOT_DIR"
    env \
        NODE_ENV=development \
        PORT="$PORT" \
        DEV_ADMIN_IDS=dev-admin \
        DELIVERY_SECRET=ci-smoke-delivery-secret \
        CONTENTS_DIR="$TMP_DIR/contents" \
        IMPORTS_DIR="$TMP_DIR/imports" \
        DRAFT_ASSETS_DIR="$TMP_DIR/draft-assets" \
        FEEDBACK_DIR="$TMP_DIR/feedback" \
        PROPOSALS_DIR="$TMP_DIR/proposals" \
        GITHUB_HANDOFF_DIR="$TMP_DIR/github-handoff" \
        GITHUB_IDENTITY_DIR="$TMP_DIR/github-identity" \
        PACK_DRAFTS_DIR="$TMP_DIR/pack-drafts" \
        PACKS_DIR="$TMP_DIR/packs" \
        RIGHTS_DIR="$TMP_DIR/rights" \
        ENTITLEMENTS_DIR="$TMP_DIR/entitlements" \
        pnpm --filter @manga/api start
) >"$API_LOG" 2>&1 &
API_PID=$!

for _ in $(seq 1 60); do
    if curl -fsS "$API/health" >/dev/null 2>&1; then
        break
    fi
    if ! kill -0 "$API_PID" >/dev/null 2>&1; then
        fail "API exited before health check passed"
    fi
    sleep 0.5
done

curl -fsS "$API/health" >/dev/null || fail "API health check did not pass"
echo "✅ API health"

LOGIN_RESPONSE="$(curl -fsS -X POST "$API/auth/dev-login" \
    -H 'Content-Type: application/json' \
    -d '{"userId":"dev-admin","name":"CI Smoke Admin"}' \
    -c "$COOKIE_JAR")"
assert_json_equals "$LOGIN_RESPONSE" "data.user.role" "admin"
echo "✅ dev-login admin"

curl -fsS -X POST "$API/admin/series" \
    -H 'Content-Type: application/json' \
    -b "$COOKIE_JAR" \
    -d '{
      "id": "translation-batch-series",
      "title": "Translation Batch Series",
      "description": "CI translation batch smoke content",
      "publicationType": "oneshot",
      "lifecycleStatus": "completed",
      "status": "completed",
      "visibility": "public"
    }' >/dev/null

curl -fsS -X POST "$API/admin/series/translation-batch-series/episodes" \
    -H 'Content-Type: application/json' \
    -b "$COOKIE_JAR" \
    -d '{
      "id": "ep01",
      "episodeNumber": 1,
      "title": "Translation Batch Episode",
      "publishedAt": "2026-06-13",
      "visibility": "public",
      "pages": [
        {
          "pageId": "translation-batch-series-ep01-p01",
          "pageNumber": 1,
          "images": { "ja": "pages/p001.png" },
          "width": 1200,
          "height": 1800,
          "panels": [
            {
              "panelId": "translation-batch-series-ep01-p01-panel-001",
              "panelNumber": 1,
              "displayRef": "p01-k01",
              "bbox": { "x": 100, "y": 100, "width": 500, "height": 600 },
              "reactionTags": []
            }
          ],
          "bubbles": [
            {
              "bubbleId": "translation-batch-series-ep01-p01-bubble-001",
              "panelId": "translation-batch-series-ep01-p01-panel-001",
              "bubbleNumber": 1,
              "displayRef": "p01-k01-f01",
              "bubbleType": "speech",
              "textOriginal": "Machine rows stay private.",
              "textDirection": "horizontal",
              "bbox": { "x": 180, "y": 160, "width": 300, "height": 140 }
            }
          ]
        }
      ]
    }' >/dev/null
echo "✅ admin content ready"

FIXTURE_DRAFT_RESPONSE="$(curl -fsS -X POST "$API/admin/pack-drafts" \
    -H 'Content-Type: application/json' \
    -b "$COOKIE_JAR" \
    -d '{
      "type": "TRANSLATION",
      "title": "Fixture Translation Batch",
      "language": "en",
      "target_series_id": "translation-batch-series",
      "target_episode_id": "ep01"
    }')"
FIXTURE_DRAFT_ID="$(node -e 'const data = JSON.parse(process.argv[1]); console.log(data.pack_draft_id);' "$FIXTURE_DRAFT_RESPONSE")"

BATCH_RESPONSE="$(curl -fsS -X POST "$API/admin/pack-drafts/${FIXTURE_DRAFT_ID}/translation-batch" \
    -H 'Content-Type: application/json' \
    -b "$COOKIE_JAR" \
    -d '{
      "series_id": "translation-batch-series",
      "episode_id": "ep01",
      "lang": "en",
      "page_numbers": [1],
      "provider_mode": "fixture"
    }')"
assert_json_equals "$BATCH_RESPONSE" "data.applied" "true"
assert_json_equals "$BATCH_RESPONSE" "data.record.entries.length" "1"
assert_json_equals "$BATCH_RESPONSE" "data.record.entries[0].metadata.translation_origin" "machine"
assert_json_equals "$BATCH_RESPONSE" "data.record.entries[0].metadata.provider" "fixture"
assert_json_equals "$BATCH_RESPONSE" "data.record.entries[0].metadata.source" "translation_import"
echo "✅ fixture translation batch applies machine-origin Pack Draft row"

PUBLIC_EPISODE_RESPONSE="$(curl -fsS "$API/series/translation-batch-series/episodes/ep01")"
node -e '
const text = process.argv[1];
if (text.includes("translation_origin") || text.includes("fixture-deterministic")) {
  console.error("Public Reader episode response leaked translation batch metadata");
  process.exit(1);
}
' "$PUBLIC_EPISODE_RESPONSE"
echo "✅ public Reader response does not leak machine-origin metadata"

NOOP_DRAFT_RESPONSE="$(curl -fsS -X POST "$API/admin/pack-drafts" \
    -H 'Content-Type: application/json' \
    -b "$COOKIE_JAR" \
    -d '{
      "type": "TRANSLATION",
      "title": "Noop Translation Batch",
      "language": "en",
      "target_series_id": "translation-batch-series",
      "target_episode_id": "ep01"
    }')"
NOOP_DRAFT_ID="$(node -e 'const data = JSON.parse(process.argv[1]); console.log(data.pack_draft_id);' "$NOOP_DRAFT_RESPONSE")"

NOOP_RESPONSE="$(curl -fsS -X POST "$API/admin/pack-drafts/${NOOP_DRAFT_ID}/translation-batch" \
    -H 'Content-Type: application/json' \
    -b "$COOKIE_JAR" \
    -d '{
      "series_id": "translation-batch-series",
      "episode_id": "ep01",
      "lang": "en",
      "page_numbers": [1],
      "provider_mode": "noop"
    }')"
assert_json_equals "$NOOP_RESPONSE" "data.applied" "false"
assert_json_equals "$NOOP_RESPONSE" "data.batch.rows.length" "0"
assert_json_equals "$NOOP_RESPONSE" "data.batch.pages[0].skippedReason" "provider_unconfigured"

NOOP_DRAFT_AFTER="$(curl -fsS "$API/admin/pack-drafts/${NOOP_DRAFT_ID}" -b "$COOKIE_JAR")"
assert_json_equals "$NOOP_DRAFT_AFTER" "data.entries.length" "0"
echo "✅ noop translation batch leaves Pack Draft unchanged"

echo "API translation batch smoke passed."
