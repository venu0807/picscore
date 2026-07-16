import { FaceLandmark, FaceLandmarkResult, ScoreResult } from '@/types';

const LANDMARK_INDICES = {
  leftEye: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
  rightEye: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
  noseTip: [1, 2, 98, 327],
  noseBridge: [6, 19, 20, 94, 125, 141, 235, 236, 3, 51, 48, 115, 131, 134, 102, 49, 220, 305, 281, 360, 279],
  mouth: [61, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318],
  jawline: [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323],
  chin: [152, 148, 176, 149, 150, 136, 172],
  leftCheek: [116, 117, 118, 119, 120, 121, 126, 142, 36, 205, 206, 207],
  rightCheek: [345, 346, 347, 348, 349, 350, 355, 371, 266, 425, 426, 427],
  forehead: [10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2],
};

function getPoint(landmarks: FaceLandmark[], idx: number): FaceLandmark {
  return landmarks[idx];
}

function distance(p1: FaceLandmark, p2: FaceLandmark): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = p1.z - p2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function vector(p1: FaceLandmark, p2: FaceLandmark): { x: number; y: number; z: number } {
  return { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
}

function dotProduct(v1: { x: number; y: number; z: number }, v2: { x: number; y: number; z: number }): number {
  return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
}

function magnitude(v: { x: number; y: number; z: number }): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function angleBetween(v1: { x: number; y: number; z: number }, v2: { x: number; y: number; z: number }): number {
  const cos = dotProduct(v1, v2) / (magnitude(v1) * magnitude(v2));
  return Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);
}

function computeSymmetry(landmarks: FaceLandmark[]): number {
  const pairs = [
    [33, 263], [7, 249], [163, 466], [144, 373], [145, 374], [153, 380], [154, 381], [155, 382], [133, 362],
    [173, 398], [157, 386], [158, 387], [159, 388], [160, 385], [161, 385], [246, 122],
    [61, 291], [84, 318], [17, 405], [314, 375], [405, 320], [320, 307], [307, 375],
    [172, 397], [136, 365], [150, 396], [149, 397], [176, 148],
  ];

  const midlineX = 0.5;
  const errors: number[] = [];

  for (const [leftIdx, rightIdx] of pairs) {
    const left = getPoint(landmarks, leftIdx);
    const right = getPoint(landmarks, rightIdx);
    const rightMirrored = { x: 1.0 - right.x, y: right.y, z: right.z };
    const error = distance(left, rightMirrored);
    errors.push(error);
  }

  const meanError = errors.reduce((a, b) => a + b, 0) / errors.length;
  const score = Math.max(0, 100 - meanError * 500);
  return Math.round(score * 10) / 10;
}

function computeHarmony(landmarks: FaceLandmark[]): number {
  const trichion = getPoint(landmarks, 10);
  const glabella = getPoint(landmarks, 9);
  const subnasale = getPoint(landmarks, 2);
  const menton = getPoint(landmarks, 152);
  const zygionL = getPoint(landmarks, 116);
  const zygionR = getPoint(landmarks, 345);

  // Facial thirds (vertical)
  const upperThird = distance(glabella, trichion);
  const middleThird = distance(subnasale, glabella);
  const lowerThird = distance(menton, subnasale);
  const totalHeight = upperThird + middleThird + lowerThird;

  const thirdRatios = [upperThird / totalHeight, middleThird / totalHeight, lowerThird / totalHeight];
  const thirdScore = Math.min(100, Math.max(0, 100 - thirdRatios.reduce((sum, r) => sum + Math.abs(r - 1/3), 0) * 150));

  // Facial fifths (horizontal)
  const faceWidth = distance(zygionR, zygionL);
  const leftEyeWidth = distance(getPoint(landmarks, 133), getPoint(landmarks, 33));
  const rightEyeWidth = distance(getPoint(landmarks, 362), getPoint(landmarks, 263));
  const intercanthal = distance(getPoint(landmarks, 133), getPoint(landmarks, 362));

  const fifthRatios = [leftEyeWidth / faceWidth, intercanthal / faceWidth, rightEyeWidth / faceWidth];
  const fifthScore = Math.min(100, Math.max(0, 100 - fifthRatios.reduce((sum, r) => sum + Math.abs(r - 0.2), 0) * 200));

  return Math.round(((thirdScore + fifthScore) / 2) * 10) / 10;
}

function computeJawline(landmarks: FaceLandmark[]): number {
  const gonionL = getPoint(landmarks, 5);
  const gonionR = getPoint(landmarks, 11);
  const menton = getPoint(landmarks, 152);

  const v1 = vector(menton, gonionL);
  const v2 = vector(menton, gonionR);
  const gonialAngle = angleBetween(v1, v2);

  // Ideal gonial angle: 115° ±15° (100-130°) is ideal
  // Score: 100 within ideal range, then falls off linearly
  const jawScore = Math.min(100, Math.max(0, 100 - Math.max(0, Math.abs(gonialAngle - 115) - 15) * 2));

  // Mandibular contour smoothness
  const jawPoints = LANDMARK_INDICES.jawline.map(i => getPoint(landmarks, i));
  const segments: number[] = [];
  for (let i = 0; i < jawPoints.length - 1; i++) {
    segments.push(distance(jawPoints[i], jawPoints[i + 1]));
  }
  const variance = segments.reduce((sum, s) => sum + Math.pow(s - segments.reduce((a, b) => a + b, 0) / segments.length, 2), 0) / segments.length;
  const contourScore = Math.max(0, 100 - variance * 1000);

  return Math.round(((jawScore + contourScore) / 2) * 10) / 10;
}

function computeCheekbones(landmarks: FaceLandmark[]): number {
  const zygionL = getPoint(landmarks, 116);
  const zygionR = getPoint(landmarks, 345);
  const subnasale = getPoint(landmarks, 2);
  const glabella = getPoint(landmarks, 9);

  const midfaceHeight = distance(subnasale, glabella);
  const cheekProjectionL = Math.abs(zygionL.x - subnasale.x);
  const cheekProjectionR = Math.abs(zygionR.x - subnasale.x);

  const projection = (cheekProjectionL + cheekProjectionR) / 2 / midfaceHeight;
  const score = Math.min(100, projection * 150);

  return Math.round(score * 10) / 10;
}

function computeEyes(landmarks: FaceLandmark[]): number {
  const medialL = getPoint(landmarks, 133);
  const lateralL = getPoint(landmarks, 33);
  const medialR = getPoint(landmarks, 362);
  const lateralR = getPoint(landmarks, 263);

  // Canthal tilt
  const tiltL = Math.atan2(lateralL.y - medialL.y, lateralL.x - medialL.x) * (180 / Math.PI);
  const tiltR = Math.atan2(lateralR.y - medialR.y, lateralR.x - medialR.x) * (180 / Math.PI);
  const avgTilt = (tiltL + tiltR) / 2;

  // Ideal positive tilt ~5°
  const tiltScore = Math.max(0, 100 - Math.abs(avgTilt - 5) * 10);

  // Eye aspect ratio (height/width)
  const eyeHL = Math.abs(getPoint(landmarks, 159).y - getPoint(landmarks, 145).y);
  const eyeWL = Math.abs(getPoint(landmarks, 133).x - getPoint(landmarks, 33).x);
  const earL = eyeHL / (eyeWL || 1);

  // Ideal EAR ~0.3
  const earScore = Math.max(0, 100 - Math.abs(earL - 0.3) * 300);

  return Math.round(((tiltScore + earScore) / 2) * 10) / 10;
}

function computeSkinQuality(imageData: Uint8ClampedArray, width: number, height: number, landmarks: FaceLandmark[]): number {
  const cheekL = landmarks[116];
  const cheekR = landmarks[345];

  function toPixel(lm: FaceLandmark): [number, number] {
    return [Math.round(lm.x * width), Math.round(lm.y * height)];
  }

  function extractPatch(center: [number, number], size = 40): number[] {
    const [cx, cy] = center;
    const half = size / 2;
    const values: number[] = [];

    for (let y = Math.max(0, cy - half); y < Math.min(height, cy + half); y++) {
      for (let x = Math.max(0, cx - half); x < Math.min(width, cx + half); x++) {
        const idx = (y * width + x) * 4;
        // Convert to grayscale
        const gray = 0.299 * imageData[idx] + 0.587 * imageData[idx + 1] + 0.114 * imageData[idx + 2];
        values.push(gray);
      }
    }
    return values;
  }

  const patchL = extractPatch(toPixel(cheekL));
  const patchR = extractPatch(toPixel(cheekR));

  if (patchL.length === 0 || patchR.length === 0) return 50;

  // Laplacian variance (simplified)
  function laplacianVar(patch: number[], w: number): number {
    const h = patch.length / w;
    let sum = 0;
    let count = 0;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const center = patch[idx];
        const laplacian = patch[idx - w] + patch[idx + w] + patch[idx - 1] + patch[idx + 1] - 4 * center;
        sum += laplacian * laplacian;
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  }

  const patchSize = 40;
  const varL = laplacianVar(patchL, patchSize);
  const varR = laplacianVar(patchR, patchSize);
  const avgVar = (varL + varR) / 2;

  // Lower variance = smoother skin (up to a point)
  const score = Math.max(0, 100 - avgVar / 5);
  return Math.round(Math.min(100, score) * 10) / 10;
}

export function scoreFace(landmarks: FaceLandmark[], imageData?: Uint8ClampedArray, width = 640, height = 480): ScoreResult {
  const symmetry = computeSymmetry(landmarks);
  const harmony = computeHarmony(landmarks);
  const jawline = computeJawline(landmarks);
  const cheekbones = computeCheekbones(landmarks);
  const eyes = computeEyes(landmarks);
  const skinQuality = imageData ? computeSkinQuality(imageData, width, height, landmarks) : 50;

  // Weighted overall score
  const weight = {
    symmetry: 0.20,
    harmony: 0.20,
    jawline: 0.15,
    cheekbones: 0.15,
    eyes: 0.15,
    skinQuality: 0.15,
  };

  const overall = Math.round(
    symmetry * weight.symmetry +
    harmony * weight.harmony +
    jawline * weight.jawline +
    cheekbones * weight.cheekbones +
    eyes * weight.eyes +
    skinQuality * weight.skinQuality
  );

  // Percentile (approximate normal distribution, mean=50, std=15)
  const percentile = Math.max(1, Math.min(99, Math.round(50 + (overall - 50) / 15 * 34.1)));

  // Generate improvements
  const improvements = generateImprovements({ symmetry, harmony, jawline, cheekbones, eyes, skinQuality });

  return {
    overall,
    symmetry,
    harmony,
    jawline,
    cheekbones,
    eyes,
    skinQuality,
    percentile,
    improvements,
  };
}

function generateImprovements(scores: Record<string, number>): string[] {
  const tips: string[] = [];

  if (scores.symmetry < 60) {
    tips.push('Facial asymmetry detected — try sleeping on your back, avoid resting face on hand');
  }
  if (scores.jawline < 60) {
    tips.push('Jawline definition: mewing posture, chewing mastic gum, reduce body fat %');
  }
  if (scores.cheekbones < 60) {
    tips.push('Cheekbone prominence: reduce sodium/bloat, buccinator exercises, consider dermal filler later');
  }
  if (scores.skinQuality < 60) {
    tips.push('Skin texture: niacinamide 10% + retinol 0.3%, 3L water daily, change pillowcase 2x/week');
  }
  if (scores.eyes < 60) {
    tips.push('Eye area: caffeine eye cream for puffiness, sleep 7-9h, limit screen before bed');
  }
  if (scores.harmony < 60) {
    tips.push('Proportions: facial hair can balance chin/jaw, hairstyle frames face shape');
  }

  // Always include universal tips
  tips.push('Posture: forward head posture hides jawline — chin tucks daily');
  tips.push('Lighting: overhead lighting casts shadows — use frontal soft light for photos');

  return tips.slice(0, 5);
}

// Quick self-check
function demo() {
  // Generate a symmetric face-like landmark set (468 landmarks, all with x,y,z)
  const landmarks = Array.from({length: 468}, (_, i) => ({
    x: Math.random(), y: Math.random(), z: Math.random() * 0.1
  }))
  const result = scoreFace(landmarks as FaceLandmark[])
  console.log('Symmetry:', result.symmetry)
  console.log('Harmony:', result.harmony)
  console.log('Jawline:', result.jawline)
  console.log('Cheekbones:', result.cheekbones)
  console.log('Eyes:', result.eyes)
  console.log('Overall:', result.overall)
  console.assert(result.overall >= 0 && result.overall <= 100, 'Overall out of range')
  console.assert(result.symmetry >= 0 && result.symmetry <= 100, 'Symmetry out of range')
  console.assert(result.harmony >= 0 && result.harmony <= 100, 'Harmony out of range')
}
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') demo()