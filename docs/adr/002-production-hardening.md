# ADR-002: 本番 hardened スキーマ・Bootstrap 自動化

**日付**: 2026-07-19  
**状態**: 採用（ADR-001 を supersede）

## 追加決定

1. **§0 RESET** — レガシー全削除後に再作成（データ不要前提・ドリフト根絶）
2. **SOS 直 INSERT 禁止** — RLS INSERT ポリシー削除 + `REVOKE INSERT` + RPC のみ
3. **検索 RPC** — GRANT authenticated + `assert_authenticated()` 二重防御
4. **レート制限** — SOS 20/分（全体）・5/分（ユーザー）
5. **Bootstrap workflow** — `SUPABASE_DB_URL` + `verify-supabase.sh` で適用・検証を 1 クリック化
6. **Seed** — `evacuation_centers.name` UNIQUE + `ON CONFLICT DO NOTHING`

## トレードオフ

- Bootstrap は **全アプリデータ削除**（auth.users 除く — profiles は DROP されるが auth ユーザーは残る）
- `SUPABASE_DB_URL` secret の初回設定は不可避（URI は Dashboard のみ）

## 根拠

[Supabase Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing) — pause 回避には実 DB activity が必要。keep-alive は INSERT 必須。
