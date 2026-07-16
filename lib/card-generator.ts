import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D } from 'canvas';
import type { ScoreResult } from '@/types';

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const MARGIN = 60;

export async function generateScoreCard(
  score: ScoreResult,
  faceImageUrl?: string,
  isWatermarked = false,
  userName?: string
): Promise<Buffer> {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  gradient.addColorStop(0, '#0f0f0f');
  gradient.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Subtle grid pattern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
  ctx.lineWidth = 1;
  for (let x = 0; x < CARD_WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CARD_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < CARD_HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CARD_WIDTH, y);
    ctx.stroke();
  }

  // Left side: Face photo or placeholder
  const photoSize = 400;
  const photoX = MARGIN;
  const photoY = (CARD_HEIGHT - photoSize) / 2;

  if (faceImageUrl) {
    try {
      const img = await loadImage(faceImageUrl);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(photoX, photoY, photoSize, photoSize, 24);
      ctx.clip();
      ctx.drawImage(img, photoX, photoY, photoSize, photoSize);
      ctx.restore();
    } catch {
      drawPlaceholder(ctx, photoX, photoY, photoSize);
    }
  } else {
    drawPlaceholder(ctx, photoX, photoY, photoSize);
  }

  // Watermark overlay for free tier
  if (isWatermarked) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(photoX, photoY, photoSize, photoSize);
    ctx.font = 'bold 28px Inter, system-ui';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.textAlign = 'center';
    ctx.fillText('FREE TIER', photoX + photoSize / 2, photoY + photoSize / 2 - 20);
    ctx.font = '18px Inter, system-ui';
    ctx.fillText('Upgrade to remove watermark', photoX + photoSize / 2, photoY + photoSize / 2 + 20);
    ctx.restore();
  }

  // Right side: Score info
  const contentX = photoX + photoSize + 40;
  const contentWidth = CARD_WIDTH - contentX - MARGIN;

  // Brand
  ctx.font = 'bold 14px Inter, system-ui';
  ctx.fillStyle = '#ef4444';
  ctx.textAlign = 'left';
  ctx.fillText('PICSCORE', contentX, photoY + 20);

  // Score circle
  const circleX = contentX + 140;
  const circleY = photoY + 140;
  const radius = 110;

  // Background circle
  ctx.beginPath();
  ctx.arc(circleX, circleY, radius + 8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fill();

  // Score ring
  const progress = score.overall / 100;
  ctx.beginPath();
  ctx.arc(circleX, circleY, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.strokeStyle = getScoreColor(score.overall);
  ctx.stroke();

  // Score number
  ctx.font = 'bold 72px Inter, system-ui';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(score.overall.toString(), circleX, circleY + 26);

  // Percentile
  ctx.font = '18px Inter, system-ui';
  ctx.fillStyle = '#a1a1aa';
  ctx.fillText(`${score.percentile}th percentile`, circleX, circleY + 60);

  // Metric bars
  const metrics = [
    { label: 'Symmetry', value: score.symmetry },
    { label: 'Harmony', value: score.harmony },
    { label: 'Jawline', value: score.jawline },
    { label: 'Cheekbones', value: score.cheekbones },
    { label: 'Eyes', value: score.eyes },
    { label: 'Skin', value: score.skinQuality },
  ];

  const barStartY = circleY + radius + 40;
  const barWidth = contentWidth - 40;
  const barHeight = 14;
  const barGap = 10;

  metrics.forEach((m, i) => {
    const y = barStartY + i * (barHeight + barGap);
    const barValue = Math.max(0, Math.min(100, m.value)) / 100;

    // Label
    ctx.font = '13px Inter, system-ui';
    ctx.fillStyle = '#e4e4e7';
    ctx.textAlign = 'left';
    ctx.fillText(m.label, contentX, y + 10);

    // Value
    ctx.font = 'bold 13px Inter, system-ui';
    ctx.fillStyle = getScoreColor(m.value);
    ctx.textAlign = 'right';
    ctx.fillText(`${m.value}`, contentX + barWidth, y + 10);

    // Bar background
    const barX = contentX + 80;
    const barY = y - 8;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth - 80, barHeight, 7);
    ctx.fill();

    // Bar fill
    ctx.fillStyle = getScoreColor(m.value);
    ctx.beginPath();
    ctx.roundRect(barX, barY, (barWidth - 80) * barValue, barHeight, 7);
    ctx.fill();
  });

  // Footer
  ctx.font = '13px Inter, system-ui';
  ctx.fillStyle = '#71717a';
  ctx.textAlign = 'center';
  ctx.fillText('Geometric face analysis • Pure math, no ML bias', CARD_WIDTH / 2, CARD_HEIGHT - 30);
  ctx.fillText('picscore.vercel.app', CARD_WIDTH / 2, CARD_HEIGHT - 12);

  return canvas.toBuffer('image/png');
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 24);
  ctx.fill();
  ctx.font = '80px';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.textAlign = 'center';
  ctx.fillText('📷', x + size / 2, y + size / 2 + 28);
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green
  if (score >= 60) return '#eab308'; // yellow
  if (score >= 40) return '#f97316'; // orange
  return '#ef4444'; // red
}

// Quick test
if (require.main === module) {
  const mockScore = {
    overall: 72,
    symmetry: 68,
    harmony: 75,
    jawline: 70,
    cheekbones: 65,
    eyes: 78,
    skinQuality: 60,
    percentile: 78,
    improvements: [],
  };
  generateScoreCard(mockScore, undefined, true)
    .then(buf => require('fs').writeFileSync('/tmp/test-card.png', buf))
    .then(() => console.log('Test card written to /tmp/test-card.png'));
}