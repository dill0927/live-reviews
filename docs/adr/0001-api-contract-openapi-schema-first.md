# API 契約は OpenAPI をスキーマ先行で書き、Go と TypeScript の両方に生成する

フロントエンド（Next.js / TypeScript）とバックエンド（Go on Lambda）の間の API は REST とし、手書きの `api/openapi.yaml` を唯一の情報源にする。Go 側は oapi-codegen でサーバーのインターフェースを生成し、リクエストの形の検証もスキーマから行う。TypeScript 側は openapi-typescript で型を生成し、openapi-fetch で呼び出す。生成コードはリポジトリにコミットし、CI で再生成して差分が出ないことを確かめる。こうすることで、契約の変更が YAML の差分として PR でレビューでき、フロントとバックエンドの型のズレをビルド時に検知できる。

## Considered Options

- **Connect RPC（protobuf）**：型安全性は最も高い。ただし呼び出しが基本 POST で、CloudFront でのキャッシュや、API Gateway HTTP API のルート単位のスロットリング（匿名投稿の不正対策の柱）と相性が悪いため採らなかった。
- **GraphQL**：この規模ではスキーマとリゾルバの手間が見合わない。
- **Go のコードから OpenAPI を生成する方式（huma など）**：YAML を書かずに済むが、契約が Go の実装の中に埋もれ、「契約を先に決めてから実装する」流れがとれないため採らなかった。
- **TypeSpec**：表現力は高いが、ツールが1段増える。

## Consequences

- API の利用者は自分たちの Next.js だけなので、URL にバージョン番号（`/v1` など）は付けず、フロントとバックエンドを同時に変更する。外部公開する場合は、この前提を見直す。
- エラーレスポンスは RFC 9457（Problem Details）に統一する。
