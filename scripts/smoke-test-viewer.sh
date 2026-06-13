#!/usr/bin/env bash
# =============================================================================
# Manga CMS — Viewer Smoke Test
#
# Validates core public Viewer routes (Astro app) to ensure SEO, OGP, and reader
# capabilities are intact for a self-hosted public launch.
# Usage: ./scripts/smoke-test-viewer.sh [VIEWER_BASE]
#
# Default VIEWER_BASE: http://localhost:4321
# =============================================================================

set -euo pipefail

VIEWER="${1:-http://localhost:4321}"
VIEWER_HOME_EXPECTED_STATUS="${VIEWER_HOME_EXPECTED_STATUS:-200}"
PASS=0
FAIL=0

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

echo ""
echo "🧪 Manga CMS Viewer Smoke Test"
echo "   Viewer: $VIEWER"
echo "   $(date)"
echo ""

# ---- 1. Basic SEO & Discoverability ----
echo "1️⃣  SEO & Discoverability"
check_status "Robots.txt" "$VIEWER/robots.txt" "200"
check_status "Sitemap" "$VIEWER/sitemap.xml" "200"
check_status "Homepage" "$VIEWER/" "$VIEWER_HOME_EXPECTED_STATUS"

# ---- 2. Works Directory ----
echo "2️⃣  Works Directory"
check_status "Works Index" "$VIEWER/works" "200"

# Find a work ID dynamically if possible, but since Viewer renders HTML, it's harder to parse.
# We'll just do a basic check on the routes. If there are no contents, these might 404,
# so we'll just check if the app responds without a 500.

status=$(curl -s -o /dev/null -w '%{http_code}' "$VIEWER/works")
if [ "$status" = "200" ]; then
    pass "Works list rendering"
fi

# ---- 3. Optional Structured Text View ----
echo "3️⃣  Structured Text View"
if [ -n "${STRUCTURED_TEXT_SMOKE_PATH:-}" ]; then
    text_url="$VIEWER$STRUCTURED_TEXT_SMOKE_PATH"
    expected="${STRUCTURED_TEXT_SMOKE_EXPECT:-enabled}"
    if [ "$expected" = "enabled" ]; then
        check_status "Structured text view enabled" "$text_url" "200"
        robots=$(curl -s "$text_url" | grep -i '<meta name="robots" content="noindex,follow"' || true)
        if [ -n "$robots" ]; then
            pass "Structured text view is noindex"
        else
            fail "Structured text view robots" "missing noindex,follow meta tag"
        fi
    elif [ "$expected" = "disabled" ]; then
        check_status "Structured text view disabled" "$text_url" "404"
    else
        fail "Structured text view config" "STRUCTURED_TEXT_SMOKE_EXPECT must be enabled or disabled"
    fi
else
    echo "  ⏭️  Set STRUCTURED_TEXT_SMOKE_PATH to verify /text ON/OFF behavior."
fi

# ---- 4. Optional Text Overlay View ----
echo "4️⃣  Text Overlay View"
if [ -n "${TEXT_OVERLAY_SMOKE_PATH:-}" ]; then
    overlay_url="$VIEWER$TEXT_OVERLAY_SMOKE_PATH"
    expected="${TEXT_OVERLAY_SMOKE_EXPECT:-enabled}"
    if [ "$expected" = "enabled" ]; then
        check_status "Text overlay view enabled" "$overlay_url" "200"
        overlay_html="$(curl -s "$overlay_url")"
        robots="$(printf '%s' "$overlay_html" | grep -i '<meta name="robots" content="noindex,follow"' || true)"
        if [ -n "$robots" ]; then
            pass "Text overlay view is noindex"
        else
            fail "Text overlay view robots" "missing noindex,follow meta tag"
        fi
        if printf '%s' "$overlay_html" | grep -qE 'translation_origin|fixture-deterministic|NOOP_TRANSLATION_PROVIDER'; then
            fail "Text overlay metadata leak" "private Pack Draft/provider metadata appeared in HTML"
        else
            pass "Text overlay hides Pack Draft/provider metadata"
        fi
    elif [ "$expected" = "disabled" ]; then
        check_status "Text overlay view disabled" "$overlay_url" "404"
    else
        fail "Text overlay config" "TEXT_OVERLAY_SMOKE_EXPECT must be enabled or disabled"
    fi
else
    echo "  ⏭️  Set TEXT_OVERLAY_SMOKE_PATH to verify /overlay ON/OFF behavior."
fi

# ---- Summary ----
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
