# ResQGo

**本番:** https://resqgo.vercel.app  
**コード:** https://github.com/KanshoVector/resqgo

災害時に **位置情報付き SOS を未ログインで投稿**し、**ログイン後**に周辺の SOS・避難所を地図上で検索・経路確認できる Web アプリ。

---

## 位置づけ

Firebase / Flutter のモバイルプロトタイプを、**Next.js + Supabase（PostGIS）** へリファクタした Web 版。被災者は **URL 1 本・ブラウザのみ**（インストール不要）。空間検索と権限境界は DB（PostGIS RPC + RLS）側に寄せている。

---

## 使い方

### 被災者（未ログイン可）

1. トップを開く → 🚨 タブで現在地取得またはピン微調整 → **状況プリセット**または自由入力
2. タイトル・詳細・緊急度・（任意）連絡先を送信
3. 通信不可時 → QR で位置・要請を手渡し（`QrBatonRelay`）

### 支援者（ログイン `user`）

1. ログイン →「周辺状況・避難所を検索」（距離は 🚨 タブの位置を基準）
2. 半径・緊急度・避難所状態で絞り込み（`sessionStorage` に保持）
3. 一覧タイトルで地図ピンへズーム → **連絡先は展開時のみ**（RPC 経由・支援者限定）→ 経路表示 / **Google Maps 徒歩ナビ**
4. 新規 SOS → Realtime（INSERT）で一覧・地図を再取得

### 避難所管理者（`shelter_admin`）

1. 運用で `profiles.role` を `shelter_admin` に設定
2. 検索結果下部の管理者メニューから、**表示中の避難所**の状態（開設中 / 満員 / 閉鎖）を更新

### 避難所詳細 → 経路

`/evacuation-centers/[id]` →「アプリ内で経路を表示」→ `/?tab=search&destLat=...` でトップ地図に描画

---

## 解決する課題

| 課題 | 方針 |
|------|------|
| 被災者が素早く「どこに・何が必要か」を伝えたい | 未ログイン・1 フォームで SOS 投稿 |
| 支援者が周辺を把握したい | ログイン後、PostGIS RPC で半径検索 |
| SOS と避難所が混ざる | テーブル分離 + タイトルフィルタ（DB + `sos.ts`） |
| 連絡先の公開範囲 | 未ログイン・地図から除外。**ログイン支援者**は RPC 経由で一覧取得（UI では折りたたみ） |
| 通信寸断 | QR による手動共有 |

---

## どう動いているか

```
ブラウザ (Next.js App Router)
 ├─ 地図・経路 … Google Maps JS API
 ├─ 投稿・検索 … Server Actions
 └─ Supabase … Auth + PostGIS RPC + RLS
       ├─ emergency_locations  … SOS
       └─ evacuation_centers     … 避難所
```

**権限の線引き**

| 操作 | 誰 | 経路 |
|------|-----|------|
| SOS 投稿 | 未ログイン可 | `create-emergency` → RPC `create_sos_emergency`（テーブル直 INSERT 不可） |
| 周辺検索 | 要ログイン | RPC `search_nearby_*`（GRANT + 関数内 `auth.uid()` チェック） |
| 避難所更新 | `shelter_admin` | RLS + `updateShelterStatus` |

**検索フォールバック**  
指定半径で 0 件 → 半径 50000 m で再検索 → まだ 0 件なら `fetch_all_map_pins` で地図のみ更新。  
**一覧は指定半径の結果のまま**（地図だけ広げる）。ロジックは `useEmergencyFeed.ts`。

**Flutter/Firebase から変えた理由（要約）**  
配信: アプリストア不要の Web。空間: GeoFire 相当を **PostGIS `st_dwithin` + GIST** に。境界: クライアント依存から **RLS + RPC** へ。

---

## 実装パラメータ

コード・マイグレーション上の定数・上限。

| 項目 | 値 | 根拠 |
|------|-----|------|
| 検索半径（デフォルト） | 5000 m | `src/lib/schemas.ts`, `EmergencyForm` |
| 検索半径（変更可能範囲） | 100〜50000 m | `schemas.ts`, `format-radius.ts`, `FilterBar` |
| 0 件時の再検索半径 | 50000 m | `useEmergencyFeed.ts` |
| RPC 半径の上限 | 50000 m | `0001_resqgo_schema.sql`（`safe_radius`） |
| 近傍 SOS 返却上限 | 200 件 | `search_nearby_emergencies` |
| 近傍避難所返却上限 | 100 件 | `search_nearby_evacuation_centers` |
| 地図フォールバック上限 | SOS・避難所 各 100 件 | `fetch_all_map_pins` |
| SOS タイトル文字数上限 | 80 文字 | `emergencyInputSchema` |
| 説明文字数上限 | 500 文字 | 同上 |
| 位置情報取得タイムアウト | 10 秒 | `GeolocationGuard.tsx` |
| QR 有効期限 | 6 時間 | `QrBatonRelay.tsx`（`QR_TTL_MS`） |
| SOS 投稿レート上限 | 全体 20/分・ユーザー 5/分 | `create_sos_emergency` RPC |
| 連絡先文字数上限 | 200 文字 | DB check + `emergencyInputSchema` |

---

## 設計判断

1. **投稿は開、閲覧は閉** — SOS は未ログイン可。検索は認証必須（支援者側の説明責任）。
2. **空間演算は DB** — 半径・距離順は RPC。一覧の距離表示のみ Haversine（表示用）。
3. **公開データは Server 経由** — ブラウザからテーブル直接操作なし。検索は RPC、投稿は Server Action。
4. **座標は `navigation.ts` に集約** — RPC は GeoJSON 返却。地図・URL・距離は `coordsFromLocation()` 一本化。

---

## ファイルマップ

| UC | 主なファイル |
|----|--------------|
| SOS 投稿 | `src/actions/create-emergency.ts`, `src/lib/sos.ts`, `src/lib/sos-templates.ts`, `src/components/QrBatonRelay.tsx`, `src/components/GeolocationGuard.tsx` |
| 周辺検索 | `src/actions/search-emergency.ts`, `src/lib/emergency-mapper.ts`, `src/actions/evacuation-centers.ts`, `src/hooks/useEmergencyFeed.ts`, `src/components/FilterBar.tsx`, `src/components/EmergencyList.tsx`, `src/components/MapView.tsx` |
| 避難所管理 | `src/actions/evacuation-centers.ts`, `src/components/ShelterAdminPanel.tsx`, `src/components/AuthProvider.tsx` |
| 経路 | `src/app/evacuation-centers/[id]/page.tsx`, `src/lib/navigation.ts`, `src/lib/geo.ts`, `src/components/MapView.tsx` |
| DB 定義 | `supabase/migrations/0001_resqgo_schema.sql`, `0002_supporter_contact_visibility.sql`, `0003_demo_sos_seed.sql` |

中枢 UI: `src/components/EmergencyForm.tsx`（地図・タブ・投稿・検索を統合）

---

## 既知の制限

- Supabase Free Plan は pause 時 **SOS 投稿・検索とも不可**（Dashboard から Resume が必要）
- 外部避難所 API・交通情報連携なし
- 地図マーカーは `google.maps.Marker`（非推奨警告あり）
- オフラインは QR **生成のみ**（読取 UI / PWA / バックグラウンド同期なし）
- `shelter_admin` 付与 UI なし（`profiles` 手動更新）
- 経路描画には **ブラウザ位置情報の許可**が必要（拒否時は手動ピン）
- 支援者認証は Email/Password のみ（身分証連携は未実装）
- `0002_supporter_contact_visibility.sql` 未適用の DB では連絡先が一覧に出ない（Bootstrap **`apply_0001_reset=false`** で適用）

---

## ライセンス

ISC
