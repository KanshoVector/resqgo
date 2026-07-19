#!/usr/bin/env bash
# Management API 経由で migrations を適用（SUPABASE_DB_URL 不要）
#
# Usage:
#   bash scripts/apply-migrations.sh              # incremental（0002+ のみ・データ保持）
#   bash scripts/apply-migrations.sh incremental  # 同上
#   bash scripts/apply-migrations.sh full        # 0001 含む（§0 RESET・全データ削除）
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
  echo "No incremental migrations to apply (0002+ なし、または未作成)."
  echo "初回セットアップなら full モード（apply_0001_reset=true）で 0001 を含めて実行。"
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
