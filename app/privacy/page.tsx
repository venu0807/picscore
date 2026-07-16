import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">PicScore</Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-16 prose prose-zinc dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-zinc-500">Last updated: July 2026</p>

        <h2>What we collect</h2>
        <ul>
          <li><strong>Face data:</strong> 468 facial landmarks (coordinates only, no raw image stored for anonymous users)</li>
          <li><strong>Images:</strong> Only if you sign in and upload. Stored securely, auto-deleted after 30 days.</li>
          <li><strong>Account info:</strong> Email address if you sign in with Google.</li>
        </ul>

        <h2>How we use it</h2>
        <p>All facial analysis runs in your browser. No face data leaves your device unless you sign in and save a result. Score data (numbers only) is used to improve our algorithms. We never sell or share biometric data.</p>

        <h2>Data retention</h2>
        <p>Anonymous sessions: nothing stored. Signed-in users: images deleted after 30 days, score history retained for 1 year.</p>

        <h2>Third-party services</h2>
        <p>We use Supabase for auth and storage, Vercel for hosting, and Gumroad for payments. Each has its own privacy policy.</p>

        <h2>Contact</h2>
        <p>Email us at privacy@picscore.app</p>
      </main>
    </div>
  );
}
