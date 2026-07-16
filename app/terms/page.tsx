import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">PicScore</Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-16 prose prose-zinc dark:prose-invert">
        <h1>Terms of Service</h1>
        <p className="text-zinc-500">Last updated: July 2026</p>
        <p>By using PicScore, you agree to these terms. PicScore provides geometric facial analysis for entertainment and looksmax education. It is not medical advice, does not diagnose conditions, and should not be used for clinical decisions.</p>
        <h2>Usage</h2>
        <p>You must be 13+ to use the service. Accounts may be terminated for abuse, spam, or harassment of other users.</p>
        <h2>Payments</h2>
        <p>Pro and Lifetime subscriptions are processed via Gumroad. Refunds follow Gumroad's 30-day policy.</p>
      </main>
    </div>
  );
}
