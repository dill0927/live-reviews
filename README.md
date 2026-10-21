# 席レポ 🎵

[https://www.sekirepo.com](https://www.sekirepo.com)

ライブの感想（主に**座席からの見え方**）を共有するためのレビューサイトです。  
アイドルファンがライブ体験を記録・共有し、これから行く人がライブ参戦準備の参考にできます。

---

## 🌟 主な機能

- 📝 ライブレビューの投稿・編集・削除
- 🏟️ 会場ごとのレビュー一覧表示
- ⭐ レビューの評価システム
- 👤 ユーザー認証（Supabase Auth）
- 🔍 レビュー検索機能
- 💖 お気に入り機能

## 🛠️ 技術スタック

- **フロントエンド**

  - Next.js 15.2.1
  - React 19
  - TypeScript
  - TailwindCSS

- **バックエンド**

  - Supabase（認証・データベース）

- **デプロイ**
  - Vercel

## 🚀 ローカル開発環境のセットアップ

1. リポジトリのクローン:

```bash
git clone https://github.com/mirianoda/live-reviews.git
cd live-reviews
```

2. 依存関係のインストール（フロントエンドは `frontend/` にあります）:

```bash
cd frontend
npm install
```

3. 環境変数の設定:
   `frontend/.env.local`ファイルを作成し、必要な環境変数を設定:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. 開発サーバーの起動:

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いて確認できます。

## 📱 機能の使い方

1. アカウントを作成してログイン
2. ライブ・コンサートのレビューを投稿
3. 他のユーザーのレビューを閲覧・評価
4. 会場ごとのレビューを検索・フィルタリング

## 🤝 コントリビューション

バグの報告や機能の提案は、GitHub の Issue を通じてお願いします。

## 📝 ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。

## 👋 作者について

[@mirianoda](https://github.com/mirianoda) - ポートフォリオプロジェクトとして開発
