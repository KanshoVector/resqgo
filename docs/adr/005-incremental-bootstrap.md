# ADR-005: Bootstrap 増分適用（0001 RESET 分離）

**日付**: 2026-07-19  
**状態**: 採用

## 決定

- **通常**: `apply_0001_reset=false` → `0002+` のみ（デモデータ・SOS 履歴を保持）
- **初回 / 完全再構築のみ**: `apply_0001_reset=true` → `0001` §0 RESET 含む（**全アプリデータ削除**）
- Bootstrap / ローカルは **`scripts/apply-migrations.sh` 一本化**

## エッジケース

| 状況 | 選択 | 結果 |
|------|------|------|
| 新規 Supabase（0001 未適用） | true（1 回） | 0001+0002 |
| 0001 済・0002 未適用 | false | 0002 のみ |
| 0002 済・再実行 | false | DROP+CREATE で idempotent |
| デモ直前に true | — | **SOS・避難所データ全消去** |

## 根拠

Bootstrap #2 失敗後の再実行で 0001 RESET がデモデータを消していた。増分適用で運用とデモの両立。
