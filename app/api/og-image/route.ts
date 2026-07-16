import { NextRequest, NextResponse } from 'next/server';
import { createCanvas, loadImage, CanvasRenderingContext2D, Image } from 'canvas';

export const runtime = 'nodejs';

interface ScoreResult {
  overall: number;
  symmetry: number;
  harmony: number;
  jawline: number;
  cheekbones: number;
  eyes: number;
  skinQuality: number;
  percentile: number;
  improvements: string[];
}

async function loadFaceImage(url: string): Promise<Image | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const image = await loadImage(Buffer.from(buffer));
    return image;
  } catch {
    return null;
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#84cc16';
  if (score >= 40) return '#eab308';
  if (score >= 20) return '#f97316';
  return '#ef4444';
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const words = text.split(' ');
  let line = '';
  let lines = 0;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && i > 0) {
      ctx.fillText(line.trim(), x, y);
      line = words[i] + ' ';
      y += lineHeight;
      lines++;
      if (lines >= maxLines) break;
    } else {
      line = testLine;
    }
  }
  if (lines < maxLines) {
    ctx.fillText(line.trim(), x, y);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const overall = parseInt(searchParams.get('overall') || '50', 10);
    const symmetry = parseInt(searchParams.get('symmetry') || '50', 10);
    const harmony = parseInt(searchParams.get('harmony') || '50', 10);
    const jawline = parseInt(searchParams.get('jawline') || '50', 10);
    const cheekbones = parseInt(searchParams.get('cheekbones') || '50', 10);
    const eyes = parseInt(searchParams.get('eyes') || '50', 10);
    const skinQuality = parseInt(searchParams.get('skinQuality') || '50', 10);
    const percentile = parseInt(searchParams.get('percentile') || '50', 10);
    const watermarked = searchParams.get('watermarked') === 'true';
    const imageUrl = searchParams.get('image') || '';

    const WIDTH = 1200;
    const HEIGHT = 630;
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // Background gradient (dark theme matching app)
    const bgGrad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    bgGrad.addColorStop(0, '#0f0f0f');
    bgGrad.addColorStop(1, '#18181b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Subtle grid pattern
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.02)';
    ctx.lineWidth = 1;
    for (let x = 0; x < WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }

    // Load and draw face photo (left side)
    let faceImage: Image | null = null;
    if (imageUrl) {
      faceImage = await loadFaceImage(imageUrl);
    }

    const photoSize = 400;
    const photoX = 60;
    const photoY = (HEIGHT - photoSize) / 2;

    if (faceImage) {
      ctx.save();
      drawRoundedRect(ctx, photoX, photoY, photoSize, photoSize, 24);
      ctx.clip();
      ctx.drawImage(faceImage, photoX, photoY, photoSize, photoSize);
      ctx.restore();

      // Photo border
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, photoX, photoY, photoSize, photoSize, 24);
      ctx.stroke();
    } else {
      // Placeholder
      ctx.fillStyle = '#27272a';
      drawRoundedRect(ctx, photoX, photoY, photoSize, photoSize, 24);
      ctx.fill();
      ctx.font = 'bold 24px Inter, system-ui';
      ctx.fillStyle = '#52525b';
      ctx.textAlign = 'center';
      ctx.fillText('📸', photoX + photoSize / 2, photoY + photoSize / 2 + 8);
    }

    // Watermark for free tier
    if (watermarked) {
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.font = 'bold 120px Inter, system-ui';
      ctx.fillStyle = '#ef4444';
      ctx.textAlign = 'center';
      ctx.translate(photoX + photoSize / 2, photoY + photoSize / 2);
      ctx.rotate(-Math.PI / 6);
      ctx.fillText('FREE', 0, 0);
      ctx.restore();
    }

    // Right panel - Scores
    const panelX = photoX + photoSize + 40;
    const panelWidth = WIDTH - panelX - 60;

    // Brand header
    ctx.font = 'bold 28px Inter, system-ui';
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'left';
    ctx.fillText('PICSCORE', panelX, 80);

    ctx.font = '14px Inter, system-ui';
    ctx.fillStyle = '#71717a';
    ctx.fillText('Geometric Face Analyzer • MediaPipe + Pure Math', panelX, 110);

    // Overall score - large circle
    const circleX = panelX + 140;
    const circleY = 220;
    const radius = 110;

    // Outer glow ring
    const glowGrad = ctx.createRadialGradient(circleX, circleY, radius, circleX, circleY, radius + 30);
    glowGrad.addColorStop(0, `${getScoreColor(overall)}40`);
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(circleX, circleY, radius + 30, 0, Math.PI * 2);
    ctx.fill();

    // Background ring
    ctx.beginPath();
    ctx.arc(circleX, circleY, radius + 8, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 16;
    ctx.stroke();

    // Progress ring
    const progress = overall / 100;
    ctx.beginPath();
    ctx.arc(circleX, circleY, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.strokeStyle = getScoreColor(overall);
    ctx.stroke();

    // Score number
    ctx.font = 'bold 72px Inter, system-ui';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(overall.toString(), circleX, circleY + 24);

    // Label
    ctx.font = '16px Inter, system-ui';
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText('OVERALL SCORE', circleX, circleY + radius + 40);

    // Percentile badge
    const badgeY = circleY + radius + 75;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
    drawRoundedRect(ctx, circleX - 100, badgeY, 200, 36, 18);
    ctx.fill();
    ctx.font = 'bold 14px Inter, system-ui';
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'center';
    ctx.fillText(`Top ${100 - percentile}% (${percentile}th percentile)`, circleX, badgeY + 24);

    // Metric bars (right of circle)
    const barsX = circleX + radius + 40;
    const metrics = [
      { label: 'SYMMETRY', value: symmetry },
      { label: 'HARMONY', value: harmony },
      { label: 'JAWLINE', value: jawline },
      { label: 'CHEEKBONES', value: cheekbones },
      { label: 'EYES', value: eyes },
      { label: 'SKIN', value: skinQuality },
    ];

    metrics.forEach((m, i) => {
      const y = 130 + i * 75;
      const barWidth = Math.min(panelWidth - (barsX - panelX) - 20, 300);

      // Label
      ctx.font = 'bold 11px Inter, system-ui';
      ctx.fillStyle = '#71717a';
      ctx.textAlign = 'left';
      ctx.fillText(m.label, barsX, y - 8);

      // Value
      ctx.font = 'bold 22px Inter, system-ui';
      ctx.fillStyle = getScoreColor(m.value);
      ctx.fillText(m.value.toString(), barsX + barWidth + 10, y + 6);

      // Bar background
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      drawRoundedRect(ctx, barsX, y + 12, barWidth, 12, 6);
      ctx.fill();

      // Bar fill
      const fillWidth = (m.value / 100) * barWidth;
      if (fillWidth > 0) {
        ctx.fillStyle = getScoreColor(m.value);
        drawRoundedRect(ctx, barsX, y + 12, fillWidth, 12, 6);
        ctx.fill();
      }
    });

    // Footer
    ctx.font = '13px Inter, system-ui';
    ctx.fillStyle = '#52525b';
    ctx.textAlign = 'center';
    ctx.fillText('Analyze your face geometry → picscore.vercel.app', WIDTH / 2, HEIGHT - 20);
    ctx.fillText('Powered by MediaPipe Face Mesh • 0 GPU cost', WIDTH / 2, HEIGHT - 4);

    // Return PNG
    const buffer = canvas.toBuffer('image/png');
    const uint8Array = new Uint8Array(buffer);
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('OG image generation error:', error);
    return new NextResponse('Error generating image', { status: 500 });
  }
}