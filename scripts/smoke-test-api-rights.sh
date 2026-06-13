#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/manga-api-rights.XXXXXX")"
API_LOG="$TMP_DIR/api.log"
ADMIN_COOKIE_JAR="$TMP_DIR/admin-cookies.txt"
USER_COOKIE_JAR="$TMP_DIR/user-cookies.txt"
NO_ACCESS_COOKIE_JAR="$TMP_DIR/no-access-cookies.txt"

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

assert_status() {
    local method="$1"
    local url="$2"
    local cookie_jar="$3"
    local expected="$4"
    local body="${5:-}"
    local output="$TMP_DIR/status-response.json"
    local status
    if [ -n "$body" ]; then
        status="$(curl -sS -o "$output" -w '%{http_code}' -X "$method" "$url" \
            -H 'Content-Type: application/json' \
            -b "$cookie_jar" \
            -d "$body")"
    else
        status="$(curl -sS -o "$output" -w '%{http_code}' -X "$method" "$url" -b "$cookie_jar")"
    fi
    if [ "$status" != "$expected" ]; then
        fail "Expected ${method} ${url} to return ${expected}, got ${status}: $(cat "$output")"
    fi
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

ADMIN_LOGIN_RESPONSE="$(curl -fsS -X POST "$API/auth/dev-login" \
    -H 'Content-Type: application/json' \
    -d '{"userId":"dev-admin","name":"CI Smoke Admin"}' \
    -c "$ADMIN_COOKIE_JAR")"
assert_json_equals "$ADMIN_LOGIN_RESPONSE" "data.user.role" "admin"
echo "✅ dev-login global admin"

USER_LOGIN_RESPONSE="$(curl -fsS -X POST "$API/auth/dev-login" \
    -H 'Content-Type: application/json' \
    -d '{"userId":"series-editor","name":"Series Editor"}' \
    -c "$USER_COOKIE_JAR")"
assert_json_equals "$USER_LOGIN_RESPONSE" "data.user.role" "user"
echo "✅ dev-login non-admin editor"

NO_ACCESS_LOGIN_RESPONSE="$(curl -fsS -X POST "$API/auth/dev-login" \
    -H 'Content-Type: application/json' \
    -d '{"userId":"no-access","name":"No Access"}' \
    -c "$NO_ACCESS_COOKIE_JAR")"
assert_json_equals "$NO_ACCESS_LOGIN_RESPONSE" "data.user.role" "user"
echo "✅ dev-login non-admin without grants"

for series_id in rights-series other-series; do
    curl -fsS -X POST "$API/admin/series" \
        -H 'Content-Type: application/json' \
        -b "$ADMIN_COOKIE_JAR" \
        -d "{
          \"id\": \"${series_id}\",
          \"title\": \"${series_id}\",
          \"description\": \"Rights smoke content\",
          \"publicationType\": \"oneshot\",
          \"lifecycleStatus\": \"completed\",
          \"status\": \"completed\",
          \"visibility\": \"public\"
        }" >/dev/null
done
echo "✅ admin created test Series"

assert_status GET "$API/admin/series" "$NO_ACCESS_COOKIE_JAR" 403
echo "✅ user without grants cannot list admin Series"

GRANT_RESPONSE="$(curl -fsS -X POST "$API/admin/rights/grants" \
    -H 'Content-Type: application/json' \
    -b "$ADMIN_COOKIE_JAR" \
    -d '{
      "subject_user_id": "series-editor",
      "role": "editor",
      "permissions": ["edit_structure"],
      "scope": { "series_id": "rights-series" },
      "notes": "CI rights smoke grant"
    }')"
GRANT_ID="$(node -e 'const data = JSON.parse(process.argv[1]); console.log(data.grant_id);' "$GRANT_RESPONSE")"
assert_json_equals "$GRANT_RESPONSE" "data.granted_by" "dev-admin"
echo "✅ admin granted series edit permission"

SERIES_LIST_RESPONSE="$(curl -fsS "$API/admin/series" -b "$USER_COOKIE_JAR")"
assert_json_equals "$SERIES_LIST_RESPONSE" "data.items.length" "1"
assert_json_equals "$SERIES_LIST_RESPONSE" "data.items[0].id" "rights-series"
echo "✅ series-scoped user lists only granted Series"

curl -fsS "$API/admin/series/rights-series" -b "$USER_COOKIE_JAR" >/dev/null
echo "✅ series-scoped user can read granted Series"

assert_status GET "$API/admin/series/other-series" "$USER_COOKIE_JAR" 403
echo "✅ series-scoped user cannot read another Series"

curl -fsS -X POST "$API/admin/series/rights-series/episodes" \
    -H 'Content-Type: application/json' \
    -b "$USER_COOKIE_JAR" \
    -d '{
      "id": "ep01",
      "episodeNumber": 1,
      "title": "Rights Smoke Episode",
      "publishedAt": "2026-06-13",
      "visibility": "public",
      "pages": [
        {
          "pageId": "rights-series-ep01-p01",
          "pageNumber": 1,
          "images": { "ja": "pages/p001.png" },
          "width": 1200,
          "height": 1800,
          "panels": [],
          "bubbles": []
        }
      ]
    }' >/dev/null
echo "✅ series-scoped user can write granted Series content"

assert_status POST "$API/admin/series/other-series/episodes" "$USER_COOKIE_JAR" 403 '{
  "id": "ep01",
  "episodeNumber": 1,
  "title": "Rejected Episode",
  "pages": []
}'
echo "✅ series-scoped user cannot write another Series"

REVOKE_RESPONSE="$(curl -fsS -X POST "$API/admin/rights/grants/${GRANT_ID}/revoke" \
    -H 'Content-Type: application/json' \
    -b "$ADMIN_COOKIE_JAR")"
assert_json_equals "$REVOKE_RESPONSE" "data.revoked_by" "dev-admin"
echo "✅ grant revoke records revoked_by"

assert_status GET "$API/admin/series/rights-series" "$USER_COOKIE_JAR" 403
echo "✅ revoked grant no longer authorizes Series read"

echo "API rights smoke passed."
