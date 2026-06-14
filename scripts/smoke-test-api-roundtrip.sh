#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/manga-api-roundtrip.XXXXXX")"
API_LOG="$TMP_DIR/api.log"
COOKIE_JAR="$TMP_DIR/cookies.txt"
EDITOR_COOKIE_JAR="$TMP_DIR/editor-cookies.txt"
MANAGER_COOKIE_JAR="$TMP_DIR/manager-cookies.txt"

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

SERIES_RESPONSE="$(curl -fsS -X POST "$API/admin/series" \
    -H 'Content-Type: application/json' \
    -b "$COOKIE_JAR" \
    -d '{
      "id": "roundtrip-series",
      "title": "Roundtrip Series",
      "description": "CI roundtrip smoke content",
      "publicationType": "oneshot",
      "lifecycleStatus": "completed",
      "status": "completed",
      "visibility": "public"
    }')"
assert_json_equals "$SERIES_RESPONSE" "data.id" "roundtrip-series"
echo "✅ admin series created"

curl -fsS -X POST "$API/admin/series/roundtrip-series/episodes" \
    -H 'Content-Type: application/json' \
    -b "$COOKIE_JAR" \
    -d '{
      "id": "ep01",
      "episodeNumber": 1,
      "title": "Roundtrip Episode",
      "publishedAt": "2026-06-12",
      "visibility": "public",
      "pages": [
        {
          "pageId": "roundtrip-series-ep01-p01",
          "pageNumber": 1,
          "images": { "ja": "pages/p001.png" },
          "width": 1200,
          "height": 1800,
          "panels": [
            {
              "panelId": "roundtrip-series-ep01-p01-panel-001",
              "panelNumber": 1,
              "displayRef": "p01-k01",
              "bbox": { "x": 100, "y": 100, "width": 500, "height": 600 },
              "reactionTags": []
            }
          ],
          "bubbles": [
            {
              "bubbleId": "roundtrip-series-ep01-p01-bubble-001",
              "panelId": null,
              "bubbleNumber": 1,
              "displayRef": "p01-f01",
              "bubbleType": "caption",
              "textOriginal": "Page-level bubble survives roundtrip.",
              "textDirection": "horizontal",
              "bbox": { "x": 700, "y": 100, "width": 300, "height": 140 }
            }
          ]
        }
      ]
    }' >/dev/null
echo "✅ admin episode saved"

EPISODE_RESPONSE="$(curl -fsS "$API/admin/series/roundtrip-series/episodes/ep01" -b "$COOKIE_JAR")"
assert_json_equals "$EPISODE_RESPONSE" "data.pages[0].bubbles[0].panelId" "null"
assert_json_equals "$EPISODE_RESPONSE" "data.pages[0].bubbles[0].bubbleId" "roundtrip-series-ep01-p01-bubble-001"
assert_json_equals "$EPISODE_RESPONSE" "data.pages[0].panels[0].panelId" "roundtrip-series-ep01-p01-panel-001"
echo "✅ panelId:null bubble roundtrip"

curl -fsS -X POST "$API/admin/rights/grants" \
    -H 'Content-Type: application/json' \
    -b "$COOKIE_JAR" \
    -d '{
      "subject_user_id": "editor-user",
      "role": "editor",
      "permissions": ["edit_structure"],
      "scope": { "series_id": "roundtrip-series" }
    }' >/dev/null

curl -fsS -X POST "$API/auth/dev-login" \
    -H 'Content-Type: application/json' \
    -d '{"userId":"editor-user","name":"CI Smoke Editor"}' \
    -c "$EDITOR_COOKIE_JAR" >/dev/null

LETTERING_EDITOR_STATUS="$(curl -sS -o "$TMP_DIR/lettering-editor-response.json" -w '%{http_code}' \
    -X PATCH "$API/admin/series/roundtrip-series/episodes/ep01/pages/roundtrip-series-ep01-p01/bubbles/roundtrip-series-ep01-p01-bubble-001/lettering" \
    -H 'Content-Type: application/json' \
    -b "$EDITOR_COOKIE_JAR" \
    -d '{"textLayout":{"lines":["Editor should not apply"]}}')"
if [ "$LETTERING_EDITOR_STATUS" != "403" ]; then
    fail "Expected edit_structure-only user to receive 403 from lettering patch, got ${LETTERING_EDITOR_STATUS}: $(cat "$TMP_DIR/lettering-editor-response.json")"
fi
echo "✅ edit_structure cannot apply lettering"

curl -fsS -X POST "$API/admin/rights/grants" \
    -H 'Content-Type: application/json' \
    -b "$COOKIE_JAR" \
    -d '{
      "subject_user_id": "manager-user",
      "role": "owner",
      "permissions": ["manage_rights"],
      "scope": { "series_id": "roundtrip-series" }
    }' >/dev/null

curl -fsS -X POST "$API/auth/dev-login" \
    -H 'Content-Type: application/json' \
    -d '{"userId":"manager-user","name":"CI Smoke Manager"}' \
    -c "$MANAGER_COOKIE_JAR" >/dev/null

LETTERING_RESPONSE="$(curl -fsS -X PATCH "$API/admin/series/roundtrip-series/episodes/ep01/pages/roundtrip-series-ep01-p01/bubbles/roundtrip-series-ep01-p01-bubble-001/lettering" \
    -H 'Content-Type: application/json' \
    -b "$MANAGER_COOKIE_JAR" \
    -d '{
      "textLayout": { "lines": ["Page-level", "bubble survives"], "inlineAlign": "center", "blockAlign": "start", "source": "manual" },
      "textStyle": { "fontSizePx": 32, "fontWeight": 500, "lineHeight": 1.25, "letterSpacing": 1, "fitMode": "fixed" }
    }')"
assert_json_equals "$LETTERING_RESPONSE" "data.episode.pages[0].bubbles[0].textLayout.lines.join('|')" "Page-level|bubble survives"
assert_json_equals "$LETTERING_RESPONSE" "data.episode.pages[0].bubbles[0].textOriginal" "Page-level bubble survives roundtrip."
assert_json_equals "$LETTERING_RESPONSE" "data.episode.pages[0].bubbles[0].bbox.width" "300"
echo "✅ manage_rights applies lettering without changing text or bbox"

LETTERING_EPISODE_RESPONSE="$(curl -fsS "$API/admin/series/roundtrip-series/episodes/ep01" -b "$MANAGER_COOKIE_JAR")"
assert_json_equals "$LETTERING_EPISODE_RESPONSE" "data.pages[0].bubbles[0].textLayout.lines.join('|')" "Page-level|bubble survives"
assert_json_equals "$LETTERING_EPISODE_RESPONSE" "data.pages[0].bubbles[0].textStyle.fontSizePx" "32"
echo "✅ lettering patch persists through admin reload"

PACK_DRAFT_RESPONSE="$(curl -fsS -X POST "$API/admin/pack-drafts" \
    -H 'Content-Type: application/json' \
    -b "$COOKIE_JAR" \
    -d '{
      "type": "TRANSLATION",
      "title": "English Roundtrip Draft",
      "language": "en",
      "target_series_id": "roundtrip-series",
      "target_episode_id": "ep01"
    }')"
PACK_DRAFT_ID="$(node -e 'const data = JSON.parse(process.argv[1]); console.log(data.pack_draft_id);' "$PACK_DRAFT_RESPONSE")"

TRANSLATION_IMPORT_RESPONSE="$(curl -fsS -X POST "$API/admin/pack-drafts/$PACK_DRAFT_ID/translation-import" \
    -H 'Content-Type: application/json' \
    -b "$COOKIE_JAR" \
    -d '{
      "series_id": "roundtrip-series",
      "episode_id": "ep01",
      "lang": "en",
      "source_format": "json",
      "apply": true,
      "entries": [
        {
          "bubble_id": "roundtrip-series-ep01-p01-bubble-001",
          "source_text": "Page-level bubble survives roundtrip.",
          "text": "Translated page-level bubble."
        }
      ]
    }')"
assert_json_equals "$TRANSLATION_IMPORT_RESPONSE" "data.applied" "true"
PACK_DRAFT_ENTRY_ID="$(node -e 'const data = JSON.parse(process.argv[1]); console.log(data.record.entries[0].entry_id);' "$TRANSLATION_IMPORT_RESPONSE")"

PACK_DRAFT_LETTERING_RESPONSE="$(curl -fsS -X PATCH "$API/admin/pack-drafts/$PACK_DRAFT_ID/entries/$PACK_DRAFT_ENTRY_ID/lettering" \
    -H 'Content-Type: application/json' \
    -b "$COOKIE_JAR" \
    -d '{
      "textLayout": { "lines": ["Translated", "bubble"], "inlineAlign": "center", "source": "manual" },
      "textStyle": { "fontSizePx": 24, "fitMode": "fixed" }
    }')"
assert_json_equals "$PACK_DRAFT_LETTERING_RESPONSE" "data.entry.text_layout.lines.join('|')" "Translated|bubble"
assert_json_equals "$PACK_DRAFT_LETTERING_RESPONSE" "data.entry.text_style.fontSizePx" "24"

curl -fsS -X PUT "$API/admin/pack-drafts/$PACK_DRAFT_ID/status" \
    -H 'Content-Type: application/json' \
    -b "$COOKIE_JAR" \
    -d '{"status":"approved"}' >/dev/null

PACK_EXPORT_RESPONSE="$(curl -fsS -X POST "$API/admin/pack-drafts/$PACK_DRAFT_ID/export" \
    -H 'Content-Type: application/json' \
    -b "$COOKIE_JAR" \
    -d '{"pack_id":"translation-en-roundtrip-ep01","is_published":true}')"
assert_json_equals "$PACK_EXPORT_RESPONSE" "data.pack.entries[0].textLayout.lines.join('|')" "Translated|bubble"
assert_json_equals "$PACK_EXPORT_RESPONSE" "data.pack.entries[0].textStyle.fontSizePx" "24"
echo "✅ translation Pack Draft lettering patch exports to published Pack"

PUBLIC_EPISODE_RESPONSE="$(curl -fsS "$API/series/roundtrip-series/episodes/ep01")"
DELIVERY_URL="$(node -e '
const data = JSON.parse(process.argv[1]);
const imageUrl = data.episode?.pages?.[0]?.images?.ja;
if (!imageUrl) process.exit(1);
console.log(imageUrl);
' "$PUBLIC_EPISODE_RESPONSE")"

DELIVERY_STATUS="$(curl -sS -o "$TMP_DIR/deliver-response.json" -w '%{http_code}' "$DELIVERY_URL")"
if [ "$DELIVERY_STATUS" != "200" ]; then
    fail "Expected generated tokenized delivery URL to pass public gates, got ${DELIVERY_STATUS}: $(cat "$TMP_DIR/deliver-response.json")"
fi
echo "✅ generated /deliver URL passes public gates"

MISSING_PAGE_TOKEN="$(DELIVERY_SECRET=ci-smoke-delivery-secret node --input-type=module -e 'const modulePath = new URL("./packages/domain/dist/delivery.js", `file://${process.cwd()}/`); const { generateDeliveryToken } = await import(modulePath.href); console.log(generateDeliveryToken("missing-page", "anonymous"));')"
MISSING_DELIVERY_STATUS="$(curl -sS -o "$TMP_DIR/missing-deliver-response.json" -w '%{http_code}' "$API/deliver/missing-page?token=$MISSING_PAGE_TOKEN&lang=ja")"
if [ "$MISSING_DELIVERY_STATUS" != "404" ]; then
    fail "Expected /deliver to return 404 for valid token targeting missing page, got ${MISSING_DELIVERY_STATUS}: $(cat "$TMP_DIR/missing-deliver-response.json")"
fi
echo "✅ /deliver public gate returns 404 for missing page"

curl -fsS -X POST "$API/admin/series/roundtrip-series/episodes" \
    -H 'Content-Type: application/json' \
    -b "$COOKIE_JAR" \
    -d '{
      "id": "hidden-ep",
      "episodeNumber": 2,
      "title": "Hidden Episode",
      "publishedAt": "2026-06-12",
      "visibility": "hidden",
      "pages": [
        {
          "pageId": "roundtrip-series-hidden-p01",
          "pageNumber": 1,
          "images": { "ja": "pages/hidden.png" },
          "width": 1200,
          "height": 1800,
          "panels": [],
          "bubbles": []
        }
      ]
    }' >/dev/null

HIDDEN_STATUS="$(curl -sS -o "$TMP_DIR/hidden-response.json" -w '%{http_code}' "$API/series/roundtrip-series/episodes/hidden-ep")"
if [ "$HIDDEN_STATUS" != "404" ]; then
    fail "Expected hidden public episode route to return 404, got ${HIDDEN_STATUS}: $(cat "$TMP_DIR/hidden-response.json")"
fi
echo "✅ hidden episode is not public"

echo "API roundtrip smoke passed."
