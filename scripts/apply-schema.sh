#!/usr/bin/env bash
# Deprecated wrapper — use apply-migrations.sh
exec "$(dirname "$0")/apply-migrations.sh" "${1:-incremental}"
