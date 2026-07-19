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

echo "=== RPC deployed (search_nearby_emergencies exists) ==="
HTTP=$(curl -s -o /tmp/rpc_probe.json -w "%{http_code}" -X POST "$URL/rpc/search_nearby_emergencies" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"lat":35.6895,"lng":139.6917,"radius_meters":5000}')
[[ "$HTTP" == "404" ]] && fail "search_nearby_emergencies not found — Bootstrap を実行（0002 未適用の可能性）"
pass "search_nearby_emergencies reachable (HTTP $HTTP)"

echo "=== anon search blocked ==="
if [[ "$HTTP" == "200" ]] && [[ "$(cat /tmp/rpc_probe.json)" != "[]" && "$(cat /tmp/rpc_probe.json)" != "null" ]]; then
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
[[ "$HTTP" == "404" ]] && fail "create_sos_emergency not found — Bootstrap（0001 未適用）を実行"
[[ "$HTTP" != "200" ]] && fail "create_sos_emergency failed (HTTP $HTTP): $(cat /tmp/sos_out.json)"
BODY=$(cat /tmp/sos_out.json)
[[ "$BODY" == "null" || -z "$BODY" ]] && fail "create_sos_emergency returned empty id"
pass "create_sos_emergency (HTTP $HTTP, id=$BODY)"

echo ""
echo "All smoke checks passed."
