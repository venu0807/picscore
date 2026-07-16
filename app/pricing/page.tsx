'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

declare global {
  interface Window { Razorpay?: any; }
}

export default function PricingPage() {
  const [market, setMarket] = useState<'india' | 'global'>('india');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const loadRazorpay = useCallback(() => new Promise<any>((resolve) => {
    if (window.Razorpay) return resolve(window.Razorpay);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(window.Razorpay);
    document.body.appendChild(s);
  }), []);

  const handleCheckout = async (plan: 'pro_monthly' | 'lifetime') => {
    if (!user) {
      supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/auth/callback?next=/pricing` } });
      return;
    }
    setLoading(plan);

    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ market, plan }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); setLoading(null); return; }

    if (data.method === 'razorpay') {
      const Razorpay = await loadRazorpay();
      const options: any = {
        key: data.key,
        amount: data.amount,
        currency: data.currency,
        name: 'PicScore',
        description: plan === 'lifetime' ? 'Lifetime Access' : 'Pro Monthly',
        prefill: { email: user.email },
        theme: { color: '#10b981' },
        handler: () => { window.location.href = '/score?checkout=success'; },
        modal: { ondismiss: () => setLoading(null) },
      };
      if (data.orderId) options.order_id = data.orderId;
      if (data.subscriptionId) options.subscription_id = data.subscriptionId;
      const rzp = new Razorpay(options);
      rzp.on('payment.failed', () => setLoading(null));
      rzp.open();
    } else if (data.url) {
      window.location.href = data.url;
    }
    setLoading(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">PicScore</Link>
          <div className="flex items-center gap-4">
            {user && <span className="text-sm text-zinc-500">{user.email?.split('@')[0]}</span>}
            <Link href="/score" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Get Scored</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-20">
        <section className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">Simple Pricing</h1>
          <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-8">One score a day free. Unlimited when you go Pro.</p>

          {/* Market toggle */}
          <div className="inline-flex bg-zinc-200 dark:bg-zinc-800 rounded-xl p-1">
            <button onClick={() => setMarket('india')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${market === 'india' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500'}`}>
              🇮🇳 India (₹)
            </button>
            <button onClick={() => setMarket('global')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${market === 'global' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500'}`}>
              🌍 Global ($)
            </button>
          </div>
        </section>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Free */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 flex flex-col">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">Free</h2>
            <p className="text-5xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">₹0</p>
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-start gap-2 text-zinc-600 dark:text-zinc-400"><span className="text-emerald-500 mt-0.5">✓</span> 1 score / day</li>
              <li className="flex items-start gap-2 text-zinc-600 dark:text-zinc-400"><span className="text-emerald-500 mt-0.5">✓</span> Watermarked card</li>
              <li className="flex items-start gap-2 text-zinc-600 dark:text-zinc-400"><span className="text-emerald-500 mt-0.5">✓</span> All 6 metrics</li>
              <li className="flex items-start gap-2 text-zinc-500"><span className="text-zinc-400 mt-0.5">✗</span> HD export</li>
              <li className="flex items-start gap-2 text-zinc-500"><span className="text-zinc-400 mt-0.5">✗</span> Trend chart</li>
              <li className="flex items-start gap-2 text-zinc-500"><span className="text-zinc-400 mt-0.5">✗</span> PDF report</li>
            </ul>
            <Link href="/score" className="block text-center bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 py-3 rounded-xl font-medium">Try Free</Link>
          </div>

          {/* Pro Monthly */}
          <div className="bg-zinc-900 dark:bg-zinc-950 rounded-3xl border-2 border-emerald-500 p-8 flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-4 py-0.5 rounded-full text-xs font-semibold">POPULAR</div>
            <h2 className="text-2xl font-bold text-white mb-2">Pro</h2>
            <p className="text-5xl font-bold text-white mb-1">{market === 'india' ? '₹299' : '$4.99'}</p>
            <p className="text-zinc-400 text-sm mb-6">/ month</p>
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-start gap-2 text-zinc-300"><span className="text-emerald-400 mt-0.5">✓</span> Unlimited scores</li>
              <li className="flex items-start gap-2 text-zinc-300"><span className="text-emerald-400 mt-0.5">✓</span> No watermark</li>
              <li className="flex items-start gap-2 text-zinc-300"><span className="text-emerald-400 mt-0.5">✓</span> HD export (4K)</li>
              <li className="flex items-start gap-2 text-zinc-300"><span className="text-emerald-400 mt-0.5">✓</span> Trend chart</li>
              <li className="flex items-start gap-2 text-zinc-300"><span className="text-emerald-400 mt-0.5">✓</span> PDF report</li>
              <li className="flex items-start gap-2 text-zinc-300"><span className="text-emerald-400 mt-0.5">✓</span> Priority support</li>
            </ul>
            <button onClick={() => handleCheckout('pro_monthly')} disabled={loading === 'pro_monthly'}
              className="block w-full text-center bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium transition-colors">
              {loading === 'pro_monthly' ? 'Processing...' : market === 'india' ? 'Subscribe ₹299/mo' : 'Subscribe $4.99/mo'}
            </button>
          </div>

          {/* Lifetime */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 flex flex-col">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">Lifetime</h2>
            <p className="text-5xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">{market === 'india' ? '₹2,999' : '$29'}</p>
            <p className="text-zinc-400 text-sm mb-6">one-time</p>
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-start gap-2 text-zinc-600 dark:text-zinc-400"><span className="text-emerald-500 mt-0.5">✓</span> Everything in Pro</li>
              <li className="flex items-start gap-2 text-zinc-600 dark:text-zinc-400"><span className="text-emerald-500 mt-0.5">✓</span> Forever — no recurring</li>
              <li className="flex items-start gap-2 text-zinc-600 dark:text-zinc-400"><span className="text-emerald-500 mt-0.5">✓</span> All future Pro features</li>
              <li className="flex items-start gap-2 text-zinc-500" />
              <li className="flex items-start gap-2 text-zinc-500" />
              <li className="flex items-start gap-2 text-zinc-500" />
            </ul>
            <button onClick={() => handleCheckout('lifetime')} disabled={loading === 'lifetime'}
              className="block w-full text-center bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium transition-colors">
              {loading === 'lifetime' ? 'Processing...' : market === 'india' ? 'Buy ₹2,999' : 'Buy $29'}
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-zinc-500 mt-8">
          {market === 'india' ? '🇮🇳 Pay via UPI, Card, NetBanking' : '🌍 Pay via Card, PayPal'}
          {!user && <span> — <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/auth/callback?next=/pricing` } })} className="text-emerald-600 underline">Sign in first</button></span>}
        </p>
      </main>
    </div>
  );
}
