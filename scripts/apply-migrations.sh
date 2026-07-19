#!/usr/bin/env bash
# Management API 経由で migrations を適用（SUPABASE_DB_URL 不要）
# デフォルト: 0002 以降のみ（0001 の §0 RESET でデータ消去しない）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-incremental}" # incremental | full

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

mapfile -t FILES < <(find "$ROOT/supabase/migrations" -name '*.sql' | sort)
if [[ "$MODE" == "incremental" ]]; then
  FILTERED=()
  for f in "${FILES[@]}"; do
    base=$(basename "$f")
    num="${base%%_*}"
    if [[ "$num" != "0001" ]]; then
      FILTERED+=("$f")
    fi
  done
  FILES=("${FILTERED[@]}")
  echo "Mode: incremental (${#FILES[@]} file(s), skipping destructive 0001)"
else
  echo "Mode: full (${#FILES[@]} file(s), WARNING: 0001 §0 RESET wipes app data)"
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No migrations to apply."
  exit 0
fi

for f in "${FILES[@]}"; do
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

echo "Migrations applied. Run: bash scripts/verify-supabase.sh"
