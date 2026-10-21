export default function TermsPage() {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">利用規約</h1>
        <p className="mb-4">
          この利用規約（以下、「本規約」）は、<strong>席レポ</strong>（以下、「当サービス」）が提供するウェブサービスの利用条件を定めるものです。
        </p>
        <h2 className="text-lg font-semibold mt-6 mb-2">第1条（適用）</h2>
        <p className="mb-4">本規約は、利用者と当サービス運営者との間の一切の関係に適用されます。</p>
        <h2 className="text-lg font-semibold mt-6 mb-2">第2条（禁止事項）</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>他人になりすましての投稿</li>
          <li>不適切な内容・スパムの投稿</li>
          <li>不正アクセス、リバースエンジニアリング</li>
        </ul>
        <h2 className="text-lg font-semibold mt-6 mb-2">第3条（アカウント削除）</h2>
        <p className="mb-4">利用者が利用規約に違反した場合、アカウントを停止・削除することがあります。</p>
        <h2 className="text-lg font-semibold mt-6 mb-2">第4条（免責事項）</h2>
        <p className="mb-4">当サービスは、レビュー内容の正確性を保証するものではありません。</p>
        <h2 className="text-lg font-semibold mt-6 mb-2">第5条（改訂）</h2>
        <p className="mb-4">本規約は必要に応じて改訂されることがあります。改訂後の内容はWebサイトにて公表します。</p>
        <h2 className="text-lg font-semibold mt-6 mb-2">第6条（準拠法）</h2>
        <p>本規約の準拠法は日本法とします。</p>
      </div>
    );
  }
  