# ADR-001: スキーマ統合・SOS RPC 化・Keep-alive 分離

**日付**: 2026-07-19  
**状態**: superseded by ADR-002

## 文脈

- マイグレーション 5 分割で追跡が困難、リモート DB と乖離（`keep_alive_ping` が repo 外、anon 検索 RPC 漏洩、未ログイン SOS が INSERT+SELECT で RLS 失敗）
- Supabase Free Plan は [7 日間 DB アクティビティ不足で pause](https://supabase.com/docs/guides/platform/free-project-pausing)。1 日 1 回の静的 ping では不十分な報告あり
- Keep-alive 用 git auto-commit が Vercel redeploy と運用を交差させていた

## 決定

1. **スキーマを `0001_resqgo_schema.sql` 1 本に統合**（§ コメントで責務分割）
2. **SOS 投稿を `create_sos_emergency` RPC**（security definer）に集約 — anon に SELECT を開けない
3. **Keep-alive は `ops_heartbeat_logs` への INSERT** + GitHub Actions 6h cron。git push 廃止、`gh-workflow-keepalive` で schedule 維持
4. **検索 RPC の GRANT は authenticated のみ**（二重防御: Server Action 認証 + DB）

## トレードオフ

| 選択 | 利点 | 欠点 |
|------|------|------|
| RPC 投稿 vs INSERT+no select | id 返却・将来レート制限可 | 既存 DB へ SQL 再適用が必要 |
| 6h cron vs 1d cron | pause 余裕（公式「数回/日」） | GitHub Actions 実行回数増 |
| 1 ファイル vs 差分 migrations | 可読性・ onboarding | 既存 `supabase_migrations` 履歴とは別管理 |

## 意図

「投稿は開、閲覧は閉」（README 設計判断 1）を DB 層まで一貫させ、**アプリ deploy / DB schema / 生存 ping を独立パイプライン**にする。

## 適用手順（本番）

Supabase SQL Editor で `supabase/migrations/0001_resqgo_schema.sql` を実行 → keep-alive workflow を手動 dispatch で確認。
