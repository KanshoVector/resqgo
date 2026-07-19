# ADR-003: Bootstrap を Management API へ移行（SUPABASE_DB_URL 廃止）

**日付**: 2026-07-19  
**状態**: 採用

## 文脈

- README が「Project Settings → Database → Connection string URI」と案内していたが、**2026 UI では Connect ボタンが正**（[公式](https://supabase.com/docs/guides/database/connecting-to-postgres)）
- Postgres パスワード URI を GitHub secret に置くのは探索コスト・ローテ負荷が高い
- [Supabase CLI `db query --linked`](https://github.com/supabase/cli/pull/4955) / Management API なら **Personal Access Token のみ**で DDL 可

## 決定

- Bootstrap workflow: `psql` + `SUPABASE_DB_URL` → **`POST /v1/projects/{ref}/database/query`** + `SUPABASE_ACCESS_TOKEN`
- project ref は `SUPABASE_URL` から自動抽出
- MCP 設計: `docs/mcp/resqgo-supabase-ops.md` + `.cursor/mcp.json.example`
- Agent Skill: `.cursor/skills/resqgo-ops/`（Ask/Agent 切替要求禁止）

## トレードオフ

- Access Token はアカウント権限を持つ → Bootstrap workflow のみ使用、read-only MCP を別途推奨
- 大きな SQL は Management API ボディ制限に依存（現行 ~500 行は問題なし）
