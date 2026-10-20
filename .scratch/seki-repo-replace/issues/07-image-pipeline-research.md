# 画像パイプラインの調査

Type: research
Status: resolved
Blocked by: —

## Question

座席レポに付ける画像のアップロードと配信の選択肢を一次情報で調べる：S3 の署名付き URL（PUT と POST policy の違い、サイズや Content-Type の制限が可能か）、CloudFront＋OAC での配信、画像の変換・最適化をどこでやるか（Next.js の Image を Vercel で使う場合の Hobby プランの上限、CloudFront Functions／Lambda@Edge、アップロード時に Lambda で変換）、それぞれの無料枠と料金。

## Research

調査結果：[docs/research/image-pipeline.md](../../../docs/research/image-pipeline.md)

## Answer

- **アップロード**：サイズ上限と Content-Type を S3 側で強制できるのは **presigned POST**（`content-length-range` を使う）。PUT ではサイズ上限を強制できない。aws-sdk-go-v2 は `PresignPostObject` に対応している（v1.61.0 以降）。Lambda の実行ロールで発行した URL は、ロールの認証情報の期限が切れた時点で使えなくなる。
- **配信**：OAI は「legacy、非推奨」で、使うなら OAC。独自ドメインの ACM 証明書は us-east-1 で発行する必要がある。CloudFront の Always Free は月 1TB・1,000 万リクエスト・CloudFront Functions 200 万回。定額制の Free プランは WAF の Web ACL を付けることが必須で、加入条件の一部は未確認。
- **変換の場所**：
  - Vercel Hobby の画像最適化：月 5,000 変換まで。超えると課金ではなく **402 エラーで新しい画像が表示されなくなる**。Hobby は非商用に限られる。
  - Lambda@Edge：無料枠がなく、Go では書けない。
  - CloudFront Functions：画像の変換はできない。
  - AWS 公式の画像変換ソリューション：Lambda 構成なら固定費はないが、認証のない公開エンドポイントができてしまう。
  - アップロード時の事前生成（S3 イベント → Go の Lambda）：cgo なしの gen2brain/webp・avif が使えるが、速度は実測が必要。
- **コスト**：月 300 枚・3 万ページビュー程度なら、どの案でも AWS 側は月 $0.3〜0.4 で、ほぼ S3 の保存料金。
- **EXIF**：Go で画像をデコードして再エンコードすると、位置情報は消える。ただし写真の向きは自分で補正する必要がある。S3 に置いた元画像には EXIF が残る。
- 未確認のまま残った点：S3 の POST policy の公式ページ本文、ACM 証明書が単体で無料か、Vercel 側で EXIF が消えるか。
