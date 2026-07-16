import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

interface ScoreData {
  overall: number;
  symmetry: number;
  harmony: number;
  jawline: number;
  cheekbones: number;
  eyes: number;
  skinQuality: number;
  percentile: number;
  improvements: string[];
  share_token: string;
  card_url: string;
  watermarked: boolean;
  user_name?: string;
}

async function getScore(shareToken: string): Promise<ScoreData | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      cookies: {
        get(name) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    }
  );

  const { data, error } = await supabase
    .from('scores')
    .select('result_json, share_token, card_url, is_watermarked, user_tier_at_time')
    .eq('share_token', shareToken)
    .single();

  if (error || !data) return null;

  const result = data.result_json as ScoreData;
  return {
    ...result,
    share_token: data.share_token,
    card_url: data.card_url,
    watermarked: data.is_watermarked,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const score = await getScore(token);

  if (!score) {
    return {
      title: 'Score Not Found | PicScore',
      description: 'This score card could not be found or has been removed.',
    };
  }

  const ogImageUrl = `/api/og-image?overall=${score.overall}&symmetry=${score.symmetry}&harmony=${score.harmony}&jawline=${score.jawline}&cheekbones=${score.cheekbones}&eyes=${score.eyes}&skinQuality=${score.skinQuality}&percentile=${score.percentile}&watermarked=${score.watermarked}&image=${encodeURIComponent(score.card_url || '')}`;

  return {
    title: `My PicScore: ${score.overall}/100 | ${score.percentile}th Percentile`,
    description: `I scored ${score.overall}/100 on PicScore — geometric face analysis (symmetry, harmony, jawline, cheekbones, eyes, skin). Pure math, no ML bias.`,
    openGraph: {
      title: `PicScore: ${score.overall}/100`,
      description: `Symmetry: ${score.symmetry} | Harmony: ${score.harmony} | Jawline: ${score.jawline} | Cheekbones: ${score.cheekbones} | Eyes: ${score.eyes} | Skin: ${score.skinQuality}`,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `PicScore result: ${score.overall}/100` }],
      type: 'website',
      siteName: 'PicScore',
    },
    twitter: {
      card: 'summary_large_image',
      title: `My PicScore: ${score.overall}/100`,
      description: `I scored ${score.overall}/100 on PicScore — geometric face analysis.`,
      images: [ogImageUrl],
    },
  };
}

export default async function ResultPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const score = await getScore(token);

  if (!score) {
    notFound();
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.location.href = "/score?shared=${token}";
            `,
          }}
        />
      </body>
    </html>
  );
}