# フロントのデータ取得の方針

Type: grilling
Status: resolved
Blocked by: 04

## Question

Next.js から Go の API をどう呼ぶか決める。Server Components やサーバー側でデータを取得する方式と、クライアント側で TanStack Query を使う方式の使い分け、キャッシュや再検証の考え方、SEO や OG 画像生成との関係を整理する。

## Answer

**今の状態（2026-10-20 に確認）**：ほぼすべてのページが `"use client"` で、ブラウザ側で Supabase からデータを取得している。サーバー側でデータを取っているのは `sitemap.ts` と OG 画像の生成だけ。ページごとの `generateMetadata` もない。そのため、検索エンジンや X のプレビューにはデータの入っていない HTML が見えやすい。

**決定**
- **役割分担**：バックエンドの仕事（データの書き換え、権限の確認、業務ルール）は Go の API だけが担う。Next.js は画面を作ることに徹する。Server Actions や API Routes を書き込みの経路にしない。
- **公開ページ**（トップ、会場ページ、座席レポの詳細、サイトマップ、OG 画像）：Server Components で Go の API を呼び、ISR で一定時間ごと（目安 60 秒）に作り直す。`generateMetadata` でページごとのタイトル、説明文、OG 画像を設定する。
- **人によって違う部分とボタンの操作**（投稿・編集・削除、いいね、マイページ、presigned POST の発行）：ブラウザから JWT を `Authorization` ヘッダーに付け、`api.sekirepo.com` を直接呼ぶ。読み込み中の状態、キャッシュ、楽観的更新は TanStack Query で扱う。呼び出しには openapi-fetch を使う（ADR 0001）。
- **公開ページの中の「自分用」の部分**（いいね済みかどうかなど）：ページ本体はサーバー側で作り、その部分だけを表示後にブラウザ側で取得して重ねる。
- **CORS**：API Gateway で `https://www.sekirepo.com`（とローカル開発のオリジン）だけを許可する。
- 申し送り（フロントエンドのマップ）
  - 投稿した直後に自分の座席レポが一覧に出ない（ISR の待ち時間）問題をどう扱うか（オンデマンド再検証、投稿直後の画面での補い方など）。
  - Supabase の JWT をブラウザのどこに保存するか（SDK の既定の保存先か Cookie か）と、XSS 対策。
  - Vercel Hobby プランの ISR と関数実行の上限の確認。
