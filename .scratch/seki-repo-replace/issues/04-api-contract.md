# API 契約の管理方式

Type: grilling
Status: resolved
Blocked by: —

## Question

フロントエンド（TypeScript）とバックエンド（Go）の間の API 契約をどう管理するか。OpenAPI を唯一の情報源にしてコード生成する方式（例：oapi-codegen / openapi-typescript）と、手書きで型を揃える方式などを比較し、どれを採るか決める。

## Answer

ADR：[API 契約は OpenAPI をスキーマ先行で書き、Go と TypeScript の両方に生成する](../../../docs/adr/0001-api-contract-openapi-schema-first.md)

- **スタイル**：REST + OpenAPI。Connect RPC と GraphQL は採らない。
- **利用者**：自分たちの Next.js だけ。URL にバージョン番号は付けず、フロントとバックエンドを同時に変更する。
- **唯一の情報源**：リポジトリ直下に手で書く `api/openapi.yaml`（スキーマ先行）。
- **Go**：oapi-codegen でサーバーのインターフェースを生成する。リクエストの形（型・必須項目・文字数・値の範囲）はスキーマに基づく検証ミドルウェアで確かめ、業務ルールは usecase 層に書く。
- **TypeScript**：openapi-typescript で型を生成し、openapi-fetch で呼び出す。データ取得の仕組みは「フロントのデータ取得の方針」で決める。
- **生成コード**：リポジトリにコミットする。CI で再生成して `git diff --exit-code` で差分がないことを確かめる。
- **エラー**：RFC 9457（Problem Details）に統一する。エラーコードの体系はバックエンドのマップで決める。
- 申し送り：oapi-codegen が対応する OpenAPI のバージョン（3.0 か 3.1 か）と、検証ミドルウェアの具体的な選定は、バックエンドのマップで確認する。
