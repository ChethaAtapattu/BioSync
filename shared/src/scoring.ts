import { EnergyBand, SignalQuality } from "./types.js";

export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export interface ScoreCalculationResult {
  score: number | null;
  band: EnergyBand;
  reason: string;
  hrvNorm: number | null;
  hrNorm: number | null;
  baseScore: number | null;
  penalty: number;
}

/**
 * Calculates the experimental Focus Score according to the provisional demo heuristic.
 * Note: These constants are unvalidated demo assumptions. Do not claim to measure cognition,
 * diagnose fatigue, or provide medical advice.
 */
export function calculateFocusScore(
  hrBpm: number | null,
  pulseRmssdMs: number | null,
  motion: number | null,
  quality: SignalQuality,
  sessionMinutes: number = 0,
  isStale: boolean = false
): ScoreCalculationResult {
  if (isStale) {
    return {
      score: null,
      band: "UNAVAILABLE",
      reason: "Sensor data stale (>15 seconds without update)",
      hrvNorm: null,
      hrNorm: null,
      baseScore: null,
      penalty: 0,
    };
  }

  if (quality === "no_contact") {
    return {
      score: null,
      band: "UNAVAILABLE",
      reason: "No finger contact detected on MAX30102 sensor",
      hrvNorm: null,
      hrNorm: null,
      baseScore: null,
      penalty: 0,
    };
  }

  if (quality === "warming_up") {
    return {
      score: null,
      band: "UNAVAILABLE",
      reason: "Sensor warming up — accumulating clean pulse intervals",
      hrvNorm: null,
      hrNorm: null,
      baseScore: null,
      penalty: 0,
    };
  }

  if (quality === "poor") {
    return {
      score: null,
      band: "UNAVAILABLE",
      reason: "Poor signal quality detected — excessive motion or noise",
      hrvNorm: null,
      hrNorm: null,
      baseScore: null,
      penalty: 0,
    };
  }

  if (motion !== null && motion > 0.45) {
    return {
      score: null,
      band: "UNAVAILABLE",
      reason: `Motion artifact high (${(motion * 100).toFixed(0)}%) — signal gated for accuracy`,
      hrvNorm: null,
      hrNorm: null,
      baseScore: null,
      penalty: 0,
    };
  }

  if (hrBpm === null || pulseRmssdMs === null) {
    return {
      score: null,
      band: "UNAVAILABLE",
      reason: "Required vital inputs missing or incomplete",
      hrvNorm: null,
      hrNorm: null,
      baseScore: null,
      penalty: 0,
    };
  }

  const hrvNorm = clamp((pulseRmssdMs - 8) / 52, 0, 1);
  const hrNorm = clamp((110 - hrBpm) / 55, 0, 1);
  const baseScore = 100 * (0.6 * hrvNorm + 0.4 * hrNorm);

  const penalty = Math.min(20, Math.max(0, sessionMinutes - 90) * 0.3);
  const finalScore = Math.round(clamp(baseScore - penalty, 0, 100));

  let band: EnergyBand = "UNAVAILABLE";
  if (finalScore >= 70) {
    band = "HIGH";
  } else if (finalScore >= 50) {
    band = "MEDIUM";
  } else if (finalScore >= 35) {
    band = "LOW";
  } else {
    band = "BREAK_SUGGESTED";
  }

  const reason =
    band === "BREAK_SUGGESTED"
      ? `Low score (${finalScore}) — break strongly recommended after continuous session effort.`
      : `Score ${finalScore} (${band} band) derived from HRV RMSSD (${pulseRmssdMs.toFixed(1)}ms) and HR (${Math.round(hrBpm)} BPM).`;

  return {
    score: finalScore,
    band,
    reason,
    hrvNorm,
    hrNorm,
    baseScore,
    penalty,
  };
}
