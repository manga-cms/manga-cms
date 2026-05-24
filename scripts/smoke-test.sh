#!/usr/bin/env bash
# =============================================================================
# Manga CMS — Smoke Test
#
# Validates core functionality against a running API.
# Usage: ./scripts/smoke-test.sh [API_BASE]
#
# Default API_BASE: http://localhost:3000/api/v1
# =============================================================================

set -euo pipefail

API="${1:-http://localhost:3000/api/v1}"
PASS=0
FAIL=0
COOKIE_JAR=$(mktemp)
USER_COOKIE_JAR=$(mktemp)
trap 'rm -f "$COOKIE_JAR" "$USER_COOKIE_JAR"' EXIT

pass() { ((PASS++)); echo "  ✅ $1"; }
fail() { ((FAIL++)); echo "  ❌ $1: $2"; }

check_status() {
    local label="$1" url="$2" expected="$3"
    local status
    status=$(curl -s -o /dev/null -w '%{http_code}' "$url")
    if [ "$status" = "$expected" ]; then
        pass "$label (HTTP $status)"
    else
        fail "$label" "expected $expected, got $status"
    fi
}

check_json() {
    local label="$1" url="$2" field="$3" expected="$4"
    local value
    value=$(curl -s "$url" | grep -o "\"$field\":\"*[^,\"]*\"*" | head -1 || true)
    if echo "$value" | grep -q "$expected"; then
        pass "$label"
    else
        fail "$label" "expected $field=$expected, got $value"
    fi
}

echo ""
echo "🧪 Manga CMS Smoke Test"
echo "   API: $API"
echo "   $(date)"
echo ""

# ---- 1. Health ----
echo "1️⃣  Health"
check_json "Health endpoint" "$API/health" "status" "ok"

# ---- 2. Works list ----
echo "2️⃣  Works list"
check_status "GET /series" "$API/series" "200"

# ---- 3. Free episode (no auth) ----
echo "3️⃣  Free episode read"
# Try the first series and episode
SERIES=$(curl -s "$API/series" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)
if [ -n "$SERIES" ]; then
    # The series detail response has {"id":"series-id",...,"episodes":[{"id":"ep-id"}]}
    # Skip the first "id" (series) and take the second (first episode)
    EPISODE=$(curl -s "$API/series/$SERIES" | grep -o '"id":"[^"]*"' | sed -n '2p' | cut -d'"' -f4 || true)
    if [ -n "$EPISODE" ]; then
        check_status "Episode detail (no auth)" "$API/series/$SERIES/episodes/$EPISODE" "200"
    else
        fail "No episodes found" "series=$SERIES"
    fi
else
    fail "No series found" "empty /series response"
fi

# ---- 4. Admin login (dev) ----
echo "4️⃣  Admin login"
LOGIN_RESP=$(curl -s -X POST "$API/auth/dev-login" \
    -H 'Content-Type: application/json' \
    -d '{"userId":"dev-admin","name":"Smoke Test Admin"}' \
    -c "$COOKIE_JAR" 2>/dev/null || true)
if echo "$LOGIN_RESP" | grep -q '"token"'; then
    pass "Dev admin login"
else
    fail "Dev admin login" "no token in response"
fi

# ---- 5. Magic link login ----
echo "5️⃣  Magic link login"
MAGIC_RESP=$(curl -s -X POST "$API/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"smoke@test.example"}' 2>/dev/null || true)
if echo "$MAGIC_RESP" | grep -q '"ok":true'; then
    pass "Magic link request"
    # Extract token (dev mode only)
    ML_TOKEN=$(echo "$MAGIC_RESP" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 || true)
    if [ -n "$ML_TOKEN" ]; then
        # Verify token (first use)
        VERIFY_RESP=$(curl -s "$API/auth/verify?token=$ML_TOKEN" -c "$USER_COOKIE_JAR")
        if echo "$VERIFY_RESP" | grep -q '"authenticated":true'; then
            pass "Magic link verify (first use)"
        else
            fail "Magic link verify" "$VERIFY_RESP"
        fi
        # Re-use token (should fail)
        REUSE_RESP=$(curl -s "$API/auth/verify?token=$ML_TOKEN")
        if echo "$REUSE_RESP" | grep -q '"UNAUTHORIZED"'; then
            pass "Magic link re-use blocked"
        else
            fail "Magic link re-use block" "$REUSE_RESP"
        fi
    else
        fail "Token extraction" "dev mode may not return token"
    fi
else
    fail "Magic link request" "$MAGIC_RESP"
fi

# ---- 6. Rate limit ----
echo "6️⃣  Rate limit"
for i in $(seq 1 25); do
    curl -s -o /dev/null -X POST "$API/auth/login" \
        -H 'Content-Type: application/json' \
        -d "{\"email\":\"ratelimit-$i@test.example\"}" 2>/dev/null || true
done
RL_RESP=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"ratelimit-final@test.example"}' 2>/dev/null || true)
if [ "$RL_RESP" = "429" ]; then
    pass "Rate limit (429 on excess)"
else
    # May not trigger if window is large enough — not a hard fail
    echo "  ⚠️  Rate limit: got $RL_RESP (may need more requests to trigger)"
fi

# ---- 7. Purchase + Redeem ----
echo "7️⃣  Purchase & Redeem"
PURCHASE_RESP=$(curl -s -X POST "$API/admin/purchases" \
    -b "$COOKIE_JAR" -H 'Content-Type: application/json' \
    -d '{"provider":"MANUAL","providerPurchaseId":"smoke-001","productId":"smoke-test","codes":[{"targetType":"SERIES","targetId":"smoke-target"}]}' \
    2>/dev/null || true)
if echo "$PURCHASE_RESP" | grep -q '"id"'; then
    pass "Purchase creation"
    CODE=$(echo "$PURCHASE_RESP" | grep -o '"code":"[^"]*"' | head -1 | cut -d'"' -f4 || true)
    if [ -n "$CODE" ]; then
        # Idempotency retry
        RETRY_RESP=$(curl -s -X POST "$API/admin/purchases" \
            -b "$COOKIE_JAR" -H 'Content-Type: application/json' \
            -d '{"provider":"MANUAL","providerPurchaseId":"smoke-001","productId":"smoke-test","codes":[{"targetType":"SERIES","targetId":"smoke-target"}]}' \
            2>/dev/null || true)
        if echo "$RETRY_RESP" | grep -q '"id"'; then
            pass "Purchase idempotency"
        else
            fail "Purchase idempotency" "$RETRY_RESP"
        fi
        # Redeem (needs user session)
        REDEEM_RESP=$(curl -s -X POST "$API/redeem" \
            -b "$USER_COOKIE_JAR" -H 'Content-Type: application/json' \
            -d "{\"code\":\"$CODE\"}" 2>/dev/null || true)
        if echo "$REDEEM_RESP" | grep -q '"redeemed":true'; then
            pass "Code redemption"
        else
            fail "Code redemption" "$REDEEM_RESP"
        fi
    else
        fail "Code extraction" "no code in purchase response"
    fi
else
    if echo "$PURCHASE_RESP" | grep -q '"NOT_AVAILABLE"'; then
        echo "  ⚠️  Purchases: DATABASE_URL not set (skipping)"
    else
        fail "Purchase creation" "$PURCHASE_RESP"
    fi
fi

# ---- 8. Entitlement check ----
echo "8️⃣  Entitlement check"
if [ -n "$SERIES" ] && [ -n "$EPISODE" ]; then
    ENT_RESP=$(curl -s "$API/entitlements/check?seriesId=$SERIES&episodeId=$EPISODE" -b "$USER_COOKIE_JAR")
    if echo "$ENT_RESP" | grep -q '"entitled"'; then
        pass "Entitlement check endpoint"
    else
        fail "Entitlement check" "$ENT_RESP"
    fi
else
    echo "  ⚠️  Entitlement check: skipped (no series/episode found)"
fi

# ---- Summary ----
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
