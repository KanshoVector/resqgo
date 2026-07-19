# ResQGo Supabase Ops — MCP 設計

**版**: 2026-07-19  
**目的**: Agent が Ask/Agent 切替なしに DB 運用・障害調査・将来ブラッシュアップできる境界を定義する。

---

## 1. なぜ MCP か

| 経路 | できること | できないこと |
|------|-----------|-------------|
| `anon` key（REST/RPC） | SOS 投稿 RPC、keep-alive | **DDL**（CREATE/DROP/GRANT） |
| `service_role` | 全 REST | GitHub/Vercel に置くべきでない |
| **Management API** | DDL・SQL 実行 | Personal Access Token が必要 |
| **MCP（公式 Supabase server）** | SQL 実行・migration・ログ | Token 設定が前提 |

→ **`SUPABASE_DB_URL`（Postgres パスワード）を GitHub に置く必要はない。**  
2026 標準は [Management API `POST /v1/projects/{ref}/database/query`](https://supabase.com/docs/guides/integrations/supabase-for-platforms) + [Supabase CLI `db query --linked`](https://github.com/supabase/cli/pull/4955)。

---

## 2. 推奨 MCP 構成

### 2.1 公式 Supabase MCP（リモート）

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=lufrjcaecogpxfbcmxpk"
    }
  }
}
```

Dashboard → **Project Settings → MCP** からも接続可（2026 UI）。

**Agent に許可するツール（最小権限）**

| ツール | 用途 | 制限 |
|--------|------|------|
| `execute_sql` | 読取検証、`SELECT` smoke | `read_only: true` 優先 |
| `list_tables` / `list_migrations` | ドリフト確認 | — |
| `apply_migration` | スキーマ変更 | **人間 approve 必須**（§0 RESET 含む） |
| `get_logs` | Auth/API 障害 | — |

**禁止（本番）**

- `service_role` key の MCP 注入
- 無条件 `apply_migration`（RESET スクリプト）

### 2.2 プロジェクト Skill（`.cursor/skills/resqgo-ops/`）

MCP 未接続時の fallback。Bootstrap workflow 名・secrets 名・障害表を内蔵。

---

## 3. Secrets マトリクス

| 保管場所 | キー | 用途 |
|----------|------|------|
| Vercel | `NEXT_PUBLIC_SUPABASE_URL` | アプリ |
| Vercel | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | アプリ |
| GitHub | `SUPABASE_URL` | keep-alive / bootstrap / smoke |
| GitHub | `SUPABASE_ANON_KEY` | 同上 |
| GitHub | `SUPABASE_ACCESS_TOKEN` | **Bootstrap のみ**（Management API） |
| ローカル `.env.local` | 上記 + Maps key | dev |
| **置かない** | `SUPABASE_DB_URL`, `service_role` | — |

---

## 4. Agent プレイブック

```
1. 症状確認 → scripts/verify-supabase.sh
2. RPC/DDL 不足 → Ops - Supabase Bootstrap（workflow_dispatch）
3. pause 疑い → Dashboard Resume → keep-alive 手動実行
4. スキーマ変更 → 0001_resqgo_schema.sql 編集 → Bootstrap → verify → commit
5. anon key ローテ → Vercel env → GitHub secrets → redeploy → smoke
```

---

## 5. 将来拡張

| Phase | 内容 |
|-------|------|
| P1 | MCP `execute_sql` read-only を CI smoke に統合 |
| P2 | Preview branch（Supabase branching）+ staging project |
| P3 | `apply_migration` を PR コメント approve 後のみ Agent 実行 |
| P4 | Pro 移行後 keep-alive 停止、Monitoring MCP へ移行 |

---

## 6. ADR 参照

- `docs/adr/002-production-hardening.md`
- `docs/adr/003-management-api-bootstrap.md`
