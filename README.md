# ResQGo

**本番 URL:** https://resqgo.vercel.app/

**リポジトリ:** https://github.com/KanshoVector/resqgo  
**CI:** `main` push で TypeScript チェック + 本番ビルド（GitHub Actions）

災害時に位置情報付きの救助要請（SOS）を投稿し、ログイン後に周辺の要請・避難所を地図上で検索・経路確認する Web アプリ。

## 何を解決するか

| 課題 | 方針 |
|------|------|
| 被災者が「どこに・何が必要か」を素早く伝えたい | 未ログインでも SOS を 1 フォームで投稿可能 |
| 支援者が周辺状況を把握したい | ログイン後、現在地半径内の SOS・避難所を PostGIS RPC で検索 |
| 避難所と SOS のデータが混ざる | `emergency_locations` は SOS のみ。避難所は `evacuation_centers` に分離 |
| 連絡先の漏洩 | RPC / 公開型から `contact_info` を除外 |
| オフライン | QR コードで位置・要請内容を手動共有（`QrBatonRelay`） |

---
## 開発哲学とアーキテクチャ選定の背景 (Why)
本プロジェクトは、「極限までリーンでコスト効率の高い災害インフラのPoC（概念実証）」をテーマにしています。 潤沢な予算を前提としたマネージドなAIエージェントインフラや高価なエンタープライズツールをあえて採用せず、**完全なOSSおよび各種クラウドサービスの無料枠（Next.js + Supabase + Vercel）のみで成立するアーキテクチャ**を追求しました。

これは単なるコスト削減ではなく、災害時という予測不能なトラフィックに対して「スケールアップ（課金）に依存せず、Server ActionsによるデータマスキングやPostGISの空間インデックス活用といった技術的工夫でどこまで堅牢なシステムを組めるか」という制約への挑戦でもあります。プロトタイプとしての限界は認識しつつも、初期フェーズにおける検証スピードとコスト効率を最優先した技術選定を行っています。

---

## 技術構成

```
Browser (Next.js 16 App Router)
  ├─ Google Maps JS API … 地図ピン・徒歩経路ポリライン
  ├─ Server Actions … SOS 投稿・検索
  └─ Supabase Auth + PostgREST + RPC
        ├─ emergency_locations (geography Point)
        └─ evacuation_centers (geography Point)
```

- **DB:** Supabase（PostgreSQL + PostGIS）
- **座標:** DB 内は `geography(Point,4326)`。フロントは GeoJSON と EWKB hex の両方を `src/lib/navigation.ts` で正規化（RPC 経由で形式が変わるため）
- **外部マップ:** `NativeMapDirectionsLink` は `<a target="_blank">` のみ（`window.open` は使わない）

---

## ローカル起動（Docker）

前提: Docker / Docker Compose が使えること。

```bash
git clone https://github.com/KanshoVector/resqgo.git
cd resqgo
cp .env.example .env.local
# .env.local に Supabase / Google Maps のキーを記入
docker compose up --build
```

ブラウザで http://localhost:3000 を開く。

初回ビルド後、`node_modules` は Docker ボリュームに保持される（ホスト側に Node を入れなくてよい）。

---

## Supabase セットアップ

1. Supabase でプロジェクト作成 → PostGIS 有効
2. SQL Editor で `supabase/migrations/` 内の SQL を **0001 → 0005 の順** に実行
3. Authentication で Email ログインを有効化（アカウント作成・ログイン用）
4. `.env.local` / Vercel 環境変数に URL と anon key を設定

| マイグレーション | 内容 |
|------------------|------|
| 0001 | 初期スキーマ（SOS テーブル、近傍検索 RPC） |
| 0002 | 優先度・避難所・profiles・RLS |
| 0003 | SOS 専用化、`fetch_all_map_pins` |
| 0004 | 地図ピン RPC の GeoJSON 化 |
| 0005 | 検索 RPC の GeoJSON 化（EWKB hex 返却問題の修正） |

0004/0005 を適用しないと、一覧の座標パースと経路リンクが動作しない。

---

## Vercel デプロイ（初回）

1. https://vercel.com/new/import?s=https://github.com/KanshoVector/resqgo を開く
2. Framework: **Next.js**（自動検出）
3. Environment Variables:

| 変数 | 説明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps JavaScript API キー |

4. **Deploy** → 完了後 `https://resqgo.vercel.app`（または Vercel が割り当てた URL）で公開
5. 以降 `main` への push で自動再デプロイ

Google Maps キーは **Maps JavaScript API** と **Directions API** を有効にし、Vercel の本番ドメインをキー制限に追加すること。

---

## 主な機能

- **SOS 投稿:** 現在地取得 or 地図ピン微調整 → タイトル・優先度・任意の連絡先
- **周辺検索:** 半径・緊急度・避難所状態でフィルタ（`sessionStorage` に保持）
- **経路:** アプリ内は Google Directions API のポリライン / 外部は Google Maps 徒歩ナビ
- **避難所詳細:** `/evacuation-centers/[id]` → トップへクエリ付きで戻り経路表示

---

## 設計上の判断（簡潔）

1. **Server Actions + RPC** … RLS と `contact_info` 秘匿をサーバー側に集約。クライアントから直接テーブルを触らない。
2. **SOS タイトルフィルタ**（`src/lib/sos.ts`）… 避難所名が SOS に混入するのを DB 削除 + アプリ側バリデーションの二段で防ぐ。
3. **検索半径フォールバック**（`useEmergencyFeed`）… 半径内 0 件時に 50 km 拡大 → それでも 0 件なら `fetch_all_map_pins` で地図だけ全体表示。
4. **座標パースの単一化**（`navigation.ts`）… PostGIS → PostgREST / `row_to_json` で GeoJSON・EWKB・WKT が混在するため、URL 生成とピン配置の前段を 1 関数に集約。

---

## 既知の制限・今後の余地

- 交通情報・外部避難所 API 連携は未実装（以前のモックは削除済み）
- 地図ピンは `google.maps.Marker`（非推奨警告あり）。Advanced Marker への移行は未着手
- オフライン SOS は QR 共有のみ。PWA / バックグラウンド同期はなし
- 避難所管理者（`shelter_admin`）のロール付与は Supabase `profiles` を手動更新する想定
- 経路表示には現在地（ブラウザ位置情報）の許可が必要

---

## 開発（Docker なし）

```bash
npm ci
cp .env.example .env.local
npm run dev
```

```bash
npm run typecheck
npm run build
```

---

## ライセンス

ISC
