import Link from 'next/link';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">PicScore</Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">Contact</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-8">Questions? Feedback? We read everything.</p>
        <div className="space-y-4">
          <p className="text-zinc-700 dark:text-zinc-300">Email: <a href="mailto:hello@picscore.app" className="text-emerald-600 dark:text-emerald-400 hover:underline">hello@picscore.app</a></p>
          <p className="text-zinc-500 text-sm">Response time: usually within 24h.</p>
        </div>
      </main>
    </div>
  );
}
