'use client';

import { useState, useCallback, useEffect } from 'react';
import { CameraCapture } from '@/components/CameraCapture';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { scoreFace } from '@/lib/geometry';
import type { ScoreResult, FaceLandmarkResult } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { type AuthUser as User } from '@supabase/supabase-js';

export default function ScorePage() {
  const [step, setStep] = useState<'capture' | 'scoring' | 'result'>('capture');
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [landmarkData, setLandmarkData] = useState<FaceLandmarkResult | null>(null);
  const [error, setError] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn = () => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  };

  const onRetry = useCallback(() => {
    setStep('capture');
    setResult(null);
    setImageData(null);
    setError('');
  }, []);

  const handleCapture = useCallback(async (imgData: string, lmData: FaceLandmarkResult) => {
    setImageData(imgData);
    setLandmarkData(lmData);
    setStep('scoring');

    const score = scoreFace(lmData.landmarks);
    setResult(score);
    setStep('result');

    // Save to backend (silent — don't block result)
    try {
      const formData = new FormData();
      const response = await fetch(imgData);
      const blob = await response.blob();
      formData.append('image', blob, 'selfie.jpg');
      formData.append('landmarks', JSON.stringify(lmData));

      const res = await fetch('/api/score', { method: 'POST', body: formData });
      if (res.status === 429) {
        const data = await res.json();
        if (data.upgrade) setError(data.error);
      }
    } catch (e) {
      console.error('Failed to save score to backend:', e);
    }
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setError(''); setStep('capture'); }} className="bg-zinc-700 px-6 py-3 rounded-xl font-medium">Try Again</button>
            <a href="/pricing" className="bg-emerald-600 hover:bg-emerald-700 px-6 py-3 rounded-xl font-medium">Upgrade to Pro →</a>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'capture') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900 py-12 px-4">
        <div className="max-w-2xl mx-auto text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">Get Your Face Score</h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-lg">Position your face in the frame. Good lighting = better accuracy.</p>
          <p className="text-xs text-emerald-500 mt-2">⚡ All scoring runs in your browser. No data uploaded.</p>
        </div>
        <CameraCapture onCapture={handleCapture} />
        <div className="mt-8 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Free tier: 1 score/day, watermarked result card</p>
        </div>
      </div>
    );
  }

  if (step === 'scoring') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900 py-12 px-4 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 border-4 border-emerald-200 dark:border-emerald-800 border-t-emerald-500 rounded-full animate-spin mx-auto mb-6" />
          <p className="text-lg text-zinc-600 dark:text-zinc-400">Analyzing your face...</p>
          <p className="text-sm text-zinc-400 mt-2">Computing symmetry, harmony, jawline, cheekbones, eyes, skin quality</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <ErrorBoundary
          fallback={
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-2xl p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Something went wrong</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-6">Failed to render your score card. Please try again.</p>
              <button onClick={onRetry} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-medium transition-colors">
                Try Again
              </button>
            </div>
          }
        >
          <ScoreCard result={result!} imageData={imageData!} onRetry={onRetry} user={user} signIn={signIn} />
        </ErrorBoundary>
      </div>
    </div>
  );
}

function ScoreCard({ result, imageData, onRetry, user, signIn }: { result: ScoreResult; imageData: string; onRetry: () => void; user: User | null; signIn: () => void; }) {
  const scoreColor = (s: number) => s >= 80 ? 'text-emerald-500' : s >= 60 ? 'text-amber-500' : 'text-rose-500';
  const scoreBg = (s: number) => s >= 80 ? 'bg-emerald-500' : s >= 60 ? 'bg-amber-500' : 'bg-rose-500';

  const categories = [
    { key: 'symmetry', label: 'Symmetry', score: result.symmetry },
    { key: 'harmony', label: 'Harmony', score: result.harmony },
    { key: 'jawline', label: 'Jawline', score: result.jawline },
    { key: 'cheekbones', label: 'Cheekbones', score: result.cheekbones },
    { key: 'eyes', label: 'Eye Area', score: result.eyes },
    { key: 'skinQuality', label: 'Skin Quality', score: result.skinQuality },
  ];

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-2xl">
      <div className="bg-zinc-900 dark:bg-zinc-950 px-6 py-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">PicScore</h2>
        <div className="flex items-center gap-3">
          {user ? (
            <span className="text-xs text-zinc-400">{user.email?.split('@')[0]}</span>
          ) : (
            <button onClick={signIn} className="text-xs text-emerald-400 hover:text-emerald-300">Sign in to save</button>
          )}
        </div>
      </div>

      <div className="px-6 pt-6 pb-4">
        {imageData && (
          <img src={imageData} alt="Your face" className="w-full max-w-md mx-auto rounded-2xl aspect-square object-cover" />
        )}
      </div>

      <div className="px-6 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <span className="text-zinc-600 dark:text-zinc-400">OVERALL SCORE</span>
          <span className={`text-4xl font-bold ${scoreColor(result.overall)}`}>{result.overall} / 100</span>
        </div>
        <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-1000 ${scoreBg(result.overall)}`} style={{ width: `${result.overall}%` }} />
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 text-center">Top {100 - result.percentile}% • {result.percentile}th percentile</p>
      </div>

      <div className="px-6 py-6 space-y-3">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Breakdown</h3>
        {categories.map(cat => (
          <div key={cat.key} className="flex items-center gap-4">
            <span className="w-28 text-sm text-zinc-600 dark:text-zinc-400">{cat.label}</span>
            <div className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-1000 ${scoreBg(cat.score)}`} style={{ width: `${cat.score}%` }} />
            </div>
            <span className={`text-sm font-mono font-medium w-10 ${scoreColor(cat.score)}`}>{cat.score}</span>
          </div>
        ))}
      </div>

      <div className="px-6 pb-6 border-t border-zinc-200 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">💡 Personalized Tips</h3>
        <ul className="space-y-2">
          {result.improvements.map((tip, i) => (
            <li key={i} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">→</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onRetry} className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 py-3 rounded-xl font-medium transition-colors">
          Try Another Angle
        </button>
        <button onClick={() => { navigator.clipboard?.writeText(window.location.href); }} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-medium transition-colors">
          Copy Link
        </button>
      </div>

      <div className="px-6 pb-4">
        <a href="/pricing" className="block text-center text-sm text-emerald-500 hover:text-emerald-400 font-medium">
          {user ? 'Upgrade to Pro — unlimited scores, no watermark →' : 'Sign in & upgrade for unlimited scores, no watermark →'}
        </a>
      </div>
      <div className="px-6 pb-4 text-center text-xs text-zinc-400">Powered by PicScore — Geometric facial analysis</div>
    </div>
  );
}
