import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">PicScore</h1>
          <nav className="flex items-center gap-6">
            <Link href="/score" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              Get Scored
            </Link>
            <Link href="/pricing" className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black px-4 py-2 rounded-lg text-sm font-medium">
              Upgrade to Pro
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-20">
        <section className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-5xl md:text-7xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">
            AI Face Rating That
            <br />
            <span className="text-emerald-600 dark:text-emerald-400">Actually Works</span>
          </h2>
          <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-10 max-w-2xl mx-auto">
            Upload a selfie → Get geometric facial analysis (symmetry, harmony, jawline, cheekbones, eyes, skin)
            → Actionable looksmax tips. No ML bias, pure math.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/score"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl text-lg font-medium transition-colors"
            >
              Rate My Face Free
            </Link>
            <Link
              href="#how-it-works"
              className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 px-8 py-4 rounded-xl text-lg font-medium transition-colors"
            >
              How It Works
            </Link>
          </div>
        </section>

        <section id="how-it-works" className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.2A2 2 0 0110.074 3H13a2 2 0 012 2v5a2 2 0 01-2 2h-1m-2 2a2 2 0 00-2 2v4a2 2 0 002 2h1m2-2a2 2 0 002-2v-4a2 2 0 00-2-2h-1" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">1. Camera or Upload</h3>
            <p className="text-zinc-600 dark:text-zinc-400">Use live camera with face mesh overlay, or upload any photo. MediaPipe runs in your browser — private, instant.</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">2. Geometric Analysis</h3>
            <p className="text-zinc-600 dark:text-zinc-400">6 metrics computed client-side: symmetry, golden-ratio harmony, jawline, cheekbones, eye area, skin quality. Pure math, no ML model to hallucinate.</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">3. Score Card + Tips</h3>
            <p className="text-zinc-600 dark:text-zinc-400">Get overall score + percentile, 6 category breakdowns, and 5 personalized looksmax tips. Share watermarked card or upgrade for HD/no watermark.</p>
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 md:p-16 text-center">
          <h3 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
            Why PicScore?
          </h3>
            <div className="grid md:grid-cols-3 gap-8 text-left max-w-4xl mx-auto">
              <div>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-1">Zero ML Bias</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm">Pure geometric formulas — same math for every face, every ethnicity. No training data, no hidden bias.</p>
              </div>
              <div>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-1">Privacy First</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm">Face mesh runs in your browser. Image only uploaded after you approve. Auto-deleted after 30 days.</p>
              </div>
              <div>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-1">Actionable Tips</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm">Not just a number — specific looksmax advice: mewing, body fat %, skincare, lighting, posture.</p>
              </div>
              <div>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-1">Free Tier Generous</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm">1 score/day, watermarked card. Pro: unlimited, HD export, trend charts, PDF reports for ₹299/mo.</p>
              </div>
              <div>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-1">Viral Share Cards</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm">Beautiful OG-image cards with your score. "My symmetry is 91 — top 8%." Friends will test themselves.</p>
              </div>
              <div>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-1">Built for India</h4>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm">₹299/mo (less than a protein shake). Hinglish content. Works on 4G. No GPU needed.</p>
              </div>
            </div>
          </section>

          <section className="text-center py-12">
            <Link
              href="/score"
              className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-4 rounded-xl text-lg font-medium transition-colors"
            >
              Get My Score Free →
            </Link>
          </section>
        </main>

        <footer className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-8">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">PicScore — Geometric facial analysis. Not medical advice.</p>
            <nav className="flex gap-6 text-sm">
              <Link href="/privacy" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200">Privacy</Link>
              <Link href="/terms" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200">Terms</Link>
              <Link href="/contact" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200">Contact</Link>
            </nav>
          </div>
        </footer>
      </div>
    );
  }