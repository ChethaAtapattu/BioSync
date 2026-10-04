import { describe, expect, it } from "vitest";
import { calculateFocusScore } from "../shared/src/scoring.js";

describe("Scoring Heuristic Engine", () => {
  it("computes HIGH energy score for optimal vitals", () => {
    // hrBpm: 68, pulseRmssdMs: 52, motion: 0.04, quality: 'good', sessionMinutes: 30
    const result = calculateFocusScore(68, 52, 0.04, "good", 30, false);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.band).toBe("HIGH");
    expect(result.hrvNorm).toBeGreaterThan(0.8);
    expect(result.hrNorm).toBeGreaterThan(0.7);
  });

  it("computes LOW energy score for elevated pulse / low RMSSD", () => {
    // hrBpm: 92, pulseRmssdMs: 28, motion: 0.08, quality: 'good', sessionMinutes: 0
    const result = calculateFocusScore(92, 28, 0.08, "good", 0, false);
    expect(result.score).toBeLessThan(50);
    expect(result.score).toBeGreaterThanOrEqual(35);
    expect(result.band).toBe("LOW");
  });

  it("applies prolonged session penalty (>90 mins)", () => {
    // 120 mins session -> (120 - 90) * 0.3 = 9 points penalty
    const freshResult = calculateFocusScore(75, 40, 0.05, "good", 0, false);
    const fatiguedResult = calculateFocusScore(75, 40, 0.05, "good", 120, false);

    expect(fatiguedResult.penalty).toBe(9);
    expect(freshResult.score! - fatiguedResult.score!).toBe(9);
  });

  it("caps maximum session penalty at 20 points", () => {
    const penaltyResult = calculateFocusScore(75, 40, 0.05, "good", 300, false);
    expect(penaltyResult.penalty).toBe(20);
  });

  it("returns score = null when data is stale (>15s)", () => {
    const result = calculateFocusScore(68, 52, 0.04, "good", 30, true);
    expect(result.score).toBeNull();
    expect(result.band).toBe("UNAVAILABLE");
    expect(result.reason).toContain("stale");
  });

  it("returns score = null for no_contact or poor quality", () => {
    const noContact = calculateFocusScore(null, null, 0.02, "no_contact", 0, false);
    expect(noContact.score).toBeNull();
    expect(noContact.band).toBe("UNAVAILABLE");

    const poorQuality = calculateFocusScore(85, 20, 0.1, "poor", 0, false);
    expect(poorQuality.score).toBeNull();
    expect(poorQuality.band).toBe("UNAVAILABLE");
  });

  it("gates score when motion artifact exceeds threshold (>0.45)", () => {
    const result = calculateFocusScore(72, 48, 0.75, "good", 0, false);
    expect(result.score).toBeNull();
    expect(result.band).toBe("UNAVAILABLE");
    expect(result.reason).toContain("Motion artifact high");
  });
});
