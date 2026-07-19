---
name: resqgo-ops
description: >-
  ResQGo の Supabase / GitHub Actions / Vercel 運用保守。スキーマ適用、keep-alive、
  SOS 障害調査、secrets 設定、MCP 連携。Supabase・deploy・DB に触る作業で必ず読む。
---

# ResQGo 運用 Skill

## 絶対ルール

- **Ask/Agent 切替をユーザーに要求しない。** 実装・検証・commit まで Agent で完遂する。
- **2026-07 時点の Supabase UI/API を参照する。** 「Project Settings → Database → Connection string URI」単体の案内は古い。
- **`SUPABASE_DB_URL` は使わない。** Management API + Personal Access Token を標準とする。

## 接続情報の正しい場所（2026-07）

| 用途 | 取得場所 |
|------|----------|
| REST URL / anon key | Dashboard → **Project Settings → API** |
| DB 接続文字列（人間が psql するとき） | プロジェクト画面上部 **Connect** → **Connection string** → URI |
| DDL 自動適用（CI/Agent） | [Account → Access Tokens](https://supabase.com/dashboard/account/tokens) → `SUPABASE_ACCESS_TOKEN` |
| project ref | `https://{ref}.supabase.co` の `{ref}`（= `supabase/config.toml` の `project_id`） |

公式: [Connect to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres) — 「Dashboard 上部の **Connect** ボタン」

## GitHub Secrets（Repository）

| Secret | 必須 | 内容 |
|--------|------|------|
| `SUPABASE_URL` | ✅ | `https://{ref}.supabase.co` |
| `SUPABASE_ANON_KEY` | ✅ | Project Settings → API → anon |
| `SUPABASE_ACCESS_TOKEN` | Bootstrap 時 | Account → Access Tokens（DB パスワード不要） |

**不要**: `SUPABASE_DB_URL`, `service_role`（原則 GitHub に置かない）

## 定番オペレーション

### 1. スキーマ適用

GitHub Actions → **Ops - Supabase Bootstrap** → Run workflow

| UI の `apply_0001_reset` | 意味 |
|--------------------------|------|
| **false**（デフォルト） | `0002+` のみ。**通常はこれ**（データ保持） |
| **true** | `0001` §0 RESET 含む。**新規 Supabase 初回のみ**（全データ削除） |

ローカル:

```bash
bash scripts/apply-migrations.sh          # incremental（0002+）
bash scripts/apply-migrations.sh full     # 0001 含む（§0 RESET）
```

### 2. 健全性確認

```bash
bash scripts/verify-supabase.sh
```

### 3. keep-alive 確認

Actions → Ops - Supabase Keep Alive → Run workflow

## 障害切り分け

| 症状 | 原因 | 対処 |
|------|------|------|
| 未ログイン SOS 失敗 | スキーマ未適用 / RPC なし | Bootstrap 実行 |
| `42501` on search as anon | 正常（ブロック済み） | — |
| keep-alive 赤 | pause / RPC 未デプロイ | Dashboard Resume → Bootstrap |
| ログイン後検索空 | profiles 未復元 / shelter_admin リセット | Bootstrap 再実行 or profiles 手動 |

## MCP

設計: `docs/mcp/resqgo-supabase-ops.md`  
推奨: 公式 `@supabase/mcp-server` + 本 repo の read-only 方針

## 変更時チェックリスト

- [ ] `supabase/migrations/` 更新（0002+ は incremental、0001 は apply_0001_reset=true のみ。デモ SOS は `0003_demo_sos_seed.sql`）
- [ ] Bootstrap workflow 実行
- [ ] `verify-supabase.sh` 通過
- [ ] README / ADR 更新
- [ ] Vercel env と GitHub secrets 同期（anon key ローテ時）
