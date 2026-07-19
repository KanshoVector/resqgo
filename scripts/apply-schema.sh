#!/usr/bin/env bash
# Management API 経由で 0001_resqgo_schema.sql を適用（SUPABASE_DB_URL 不要）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"
  set +a
fi

TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
URL="${NEXT_PUBLIC_SUPABASE_URL:-${SUPABASE_URL:-}}"

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: SUPABASE_ACCESS_TOKEN required"
  echo "Create at: https://supabase.com/dashboard/account/tokens"
  exit 1
fi
if [[ -z "$URL" ]]; then
  echo "ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL required"
  exit 1
fi

REF="${URL#https://}"
REF="${REF%%.supabase.co*}"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "Applying $(basename "$f") ..."
  SQL_JSON=$(jq -Rs . "$f")
  HTTP=$(curl -s -o /tmp/resqgo_apply.json -w "%{http_code}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": ${SQL_JSON}}" \
    -X POST "https://api.supabase.com/v1/projects/${REF}/database/query")
  echo "HTTP ${HTTP}"
  cat /tmp/resqgo_apply.json
  [[ "$HTTP" == "200" || "$HTTP" == "201" ]] || exit 1
done
echo "All migrations applied. Run: bash scripts/verify-supabase.sh"
