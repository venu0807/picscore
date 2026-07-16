export interface FaceLandmark {
  x: number;
  y: number;
  z: number;
}

export interface FaceLandmarkResult {
  landmarks: FaceLandmark[];
  imageWidth: number;
  imageHeight: number;
}

export interface ScoreResult {
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

export interface Score {
  id: string;
  userId: string;
  imageUrl: string;
  landmarksJson: FaceLandmarkResult;
  resultJson: ScoreResult;
  shareToken?: string;
  isWatermarked: boolean;
  createdAt: string;
}

export interface Profile {
  id: string;
  username?: string;
  gender?: 'male' | 'female' | 'other';
  age?: number;
  tier: 'free' | 'pro' | 'lifetime';
  scoresToday: number;
  lastScoreDate: string;
  totalScores: number;
  stripeCustomerId?: string;
  createdAt: string;
}