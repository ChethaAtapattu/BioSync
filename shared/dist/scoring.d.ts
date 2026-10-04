import { EnergyBand, SignalQuality } from "./types.js";
export declare function clamp(val: number, min: number, max: number): number;
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
export declare function calculateFocusScore(hrBpm: number | null, pulseRmssdMs: number | null, motion: number | null, quality: SignalQuality, sessionMinutes?: number, isStale?: boolean): ScoreCalculationResult;
