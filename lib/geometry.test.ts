// lib/geometry.test.ts — Unit tests for core face scoring geometry
import { describe, it, expect, beforeAll } from 'vitest'
import { scoreFace } from '@/lib/geometry'
import type { FaceLandmark } from '@/types'

// Generate mock landmarks matching MediaPipe 468-point face mesh structure
function createMockLandmarks(overrides: Partial<FaceLandmark>[] = []): FaceLandmark[] {
  const landmarks: FaceLandmark[] = []
  for (let i = 0; i < 468; i++) {
    // Create a roughly face-shaped distribution
    const angle = (i / 468) * Math.PI * 2
    const radius = 0.3 + 0.1 * Math.sin(angle * 4)
    landmarks.push({
      x: Math.cos(angle) * radius + 0.5,
      y: Math.sin(angle) * radius + 0.5,
      z: 0,
    })
  }

  // Apply overrides for specific indices
  for (const { index, ...props } of overrides) {
    if (index >= 0 && index < 468) {
      landmarks[index] = { ...landmarks[index], ...props }
    }
  }

  return landmarks
}

describe('scoreFace', () => {
  let mockLandmarks: FaceLandmark[]

  beforeAll(() => {
    mockLandmarks = createMockLandmarks()
  })

  it('should return a valid score object', () => {
    const result = scoreFace(mockLandmarks)
    expect(result).toBeDefined()
    expect(result.overall).toBeGreaterThanOrEqual(0)
    expect(result.overall).toBeLessThanOrEqual(100)
    expect(result.symmetry).toBeGreaterThanOrEqual(0)
    expect(result.symmetry).toBeLessThanOrEqual(100)
    expect(result.harmony).toBeGreaterThanOrEqual(0)
    expect(result.jawline).toBeGreaterThanOrEqual(0)
    expect(result.cheekbones).toBeGreaterThanOrEqual(0)
    expect(result.eyes).toBeGreaterThanOrEqual(0)
    expect(result.skinQuality).toBeGreaterThanOrEqual(0)
    expect(result.percentile).toBeGreaterThanOrEqual(0)
    expect(result.percentile).toBeLessThanOrEqual(100)
    expect(Array.isArray(result.improvements)).toBe(true)
  })

  it('should have all required metrics', () => {
    const result = scoreFace(mockLandmarks)
    const requiredMetrics = ['overall', 'symmetry', 'harmony', 'jawline', 'cheekbones', 'eyes', 'skinQuality', 'percentile', 'improvements']
    for (const metric of requiredMetrics) {
      expect(result).toHaveProperty(metric)
    }
  })

  it('should throw for invalid landmark count', () => {
    const invalid = mockLandmarks.slice(0, 100)
    expect(() => scoreFace(invalid)).toThrow()
  })

  it('should return percentile between 0 and 100', () => {
    const result = scoreFace(mockLandmarks)
    expect(result.percentile).toBeGreaterThanOrEqual(0)
    expect(result.percentile).toBeLessThanOrEqual(100)
  })

  it('should provide at least one improvement suggestion', () => {
    const result = scoreFace(mockLandmarks)
    expect(result.improvements.length).toBeGreaterThan(0)
  })

  it('should handle different landmark configurations', () => {
    // Test with slightly different face shape
    const altLandmarks = createMockLandmarks([
      { index: 10, x: 0.5, y: 0.2, z: 0 }, // forehead
      { index: 152, x: 0.5, y: 0.85, z: 0 }, // chin
    ])
    const result = scoreFace(altLandmarks)
    expect(result.overall).toBeGreaterThanOrEqual(0)
    expect(result.overall).toBeLessThanOrEqual(100)
  })

  it('should be deterministic for same input', () => {
    const result1 = scoreFace(mockLandmarks)
    const result2 = scoreFace(mockLandmarks)
    expect(result1.overall).toBe(result2.overall)
    expect(result1.symmetry).toBe(result2.symmetry)
    expect(result1.harmony).toBe(result2.harmony)
  })
})