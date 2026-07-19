#!/usr/bin/env bash
# Supabase RPC スモークテスト（スキーマ適用後）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"
  set +a
fi

URL="${NEXT_PUBLIC_SUPABASE_URL:-${SUPABASE_URL:-}}"
KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY:-}}"

if [[ -z "$URL" || -z "$KEY" ]]; then
  echo "ERROR: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY required"
  exit 1
fi

URL="${URL%/}/rest/v1"

fail() { echo "FAIL: $1"; exit 1; }
pass() { echo "PASS: $1"; }

echo "=== keep_alive_ping ==="
BODY=$(curl -sf -X POST "$URL/rpc/keep_alive_ping" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{}')
echo "$BODY" | grep -q '"status".*"ok"' || fail "keep_alive_ping response: $BODY"
pass "keep_alive_ping"

echo "=== anon search blocked ==="
HTTP=$(curl -s -o /tmp/rpc_out.json -w "%{http_code}" -X POST "$URL/rpc/search_nearby_emergencies" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"lat":35.6895,"lng":139.6917,"radius_meters":5000}')
if [[ "$HTTP" == "200" ]] && [[ "$(cat /tmp/rpc_out.json)" != "[]" && "$(cat /tmp/rpc_out.json)" != "null" ]]; then
  fail "anon search should not return data (HTTP $HTTP)"
fi
pass "anon search blocked or empty (HTTP $HTTP)"

echo "=== direct table insert blocked ==="
HTTP=$(curl -s -o /tmp/insert_out.json -w "%{http_code}" -X POST "$URL/emergency_locations" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"title":"直叩きテスト","priority":"low","location":"SRID=4326;POINT(139.6917 35.6895)"}')
[[ "$HTTP" == "201" ]] && fail "direct insert should be blocked (got 201)"
pass "direct insert blocked (HTTP $HTTP)"

echo "=== create_sos_emergency ==="
HTTP=$(curl -s -o /tmp/sos_out.json -w "%{http_code}" -X POST "$URL/rpc/create_sos_emergency" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_title":"スモークテストSOS","p_priority":"low","p_lng":139.6917,"p_lat":35.6895}')
[[ "$HTTP" != "200" ]] && fail "create_sos_emergency failed (HTTP $HTTP): $(cat /tmp/sos_out.json)"
pass "create_sos_emergency (HTTP $HTTP)"

echo ""
echo "All smoke checks passed."
