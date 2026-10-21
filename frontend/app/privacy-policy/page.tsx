export default function PrivacyPolicyPage() {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">プライバシーポリシー</h1>
        <p className="mb-4">
          本プライバシーポリシーは、<strong>席レポ</strong>（以下、「本サービス」）が、利用者の個人情報をどのように取り扱うかを定めたものです。
        </p>
        <h2 className="text-lg font-semibold mt-6 mb-2">1. 取得する情報</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>メールアドレス（Google、XでのOAuthログイン時）</li>
          <li>プロフィール画像（SNS連携時）</li>
          <li>投稿内容（レビュー、コメントなど）</li>
        </ul>
        <h2 className="text-lg font-semibold mt-6 mb-2">2. 利用目的</h2>
        <p className="mb-4">
          取得した情報は以下の目的に利用されます：アカウント認証・管理、投稿者の識別、重要なお知らせの送信。
        </p>
        <h2 className="text-lg font-semibold mt-6 mb-2">3. 第三者提供について</h2>
        <p className="mb-4">
          利用者の同意なく、個人情報を第三者に提供することはありません。
        </p>
        <h2 className="text-lg font-semibold mt-6 mb-2">4. 情報の保護</h2>
        <p className="mb-4">
          取得した情報は、Supabaseのセキュリティ基準に則って安全に管理されます。
        </p>
        <h2 className="text-lg font-semibold mt-6 mb-2">5. 改訂について</h2>
        <p className="mb-4">
          本ポリシーは予告なく改訂される場合があります。改訂後の内容はWebサイトにて速やかに公開されます。
        </p>
        <h2 className="text-lg font-semibold mt-6 mb-2">6. お問い合わせ</h2>
        <p>プライバシーに関するお問い合わせは info@sekirepo.com までご連絡ください。</p>
      </div>
    );
  }