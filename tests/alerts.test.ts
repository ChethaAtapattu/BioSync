import { describe, expect, it } from "vitest";
import { createInitialAlertState, evaluateAlerts, AlertEvaluatorState } from "../shared/src/alerts.js";

describe("System Alert Evaluator & Regression Tests", () => {
  const baseTime = 1759650000000; // Fixed epoch timestamp in ms

  /**
   * Helper function simulating realistic 5-second telemetry stream ticks.
   */
  function simulateStream(
    initialState: AlertEvaluatorState,
    durationMs: number,
    startMs: number,
    score: number = 25,
    sessionIsActive: boolean = true
  ) {
    let state = initialState;
    const stepMs = 5000; // 5s telemetry stream interval
    let allNewAlerts: any[] = [];

    for (let elapsed = 0; elapsed <= durationMs; elapsed += stepMs) {
      const currentMs = startMs + elapsed;
      const res = evaluateAlerts(state, {
        score,
        isValid: true,
        sessionIsActive,
        accumulatedMinutes: elapsed / 60000,
        nowMs: currentMs,
      });
      state = res.nextState;
      if (res.newAlerts.length > 0) {
        allNewAlerts.push(...res.newAlerts);
      }
    }
    return { state, newAlerts: allNewAlerts };
  }

  it("triggers Break Recommendation after 10 consecutive minutes of valid low score (<35) during active session", () => {
    const initialState = createInitialAlertState();

    // 10 minutes = 600,000 ms of periodic 5s ticks
    const { state, newAlerts } = simulateStream(initialState, 10 * 60 * 1000, baseTime, 25, true);

    expect(state.lowScoreConsecutiveMs).toBeGreaterThanOrEqual(600000);
    expect(newAlerts.length).toBe(1);
    expect(newAlerts[0].type).toBe("BREAK_RECOMMENDED_10M_LOW");
  });

  it("resets 10-consecutive-minute accumulator when session is paused or reset", () => {
    const initialState = createInitialAlertState();

    // Accumulate 5 minutes of low score
    const { state: midState } = simulateStream(initialState, 5 * 60 * 1000, baseTime, 25, true);
    expect(midState.lowScoreConsecutiveMs).toBeGreaterThanOrEqual(300000);

    // Session paused! (sessionIsActive = false)
    const pauseRes = evaluateAlerts(midState, {
      score: 25,
      isValid: true,
      sessionIsActive: false, // PAUSED
      accumulatedMinutes: 5,
      nowMs: baseTime + 5 * 60 * 1000 + 5000,
    });

    // Consecutive low-score timer MUST reset to 0!
    expect(pauseRes.nextState.lowScoreConsecutiveMs).toBe(0);
  });

  it("resets 10-consecutive-minute accumulator when telemetry gap exceeds 15 seconds", () => {
    const initialState = createInitialAlertState();

    const { state: midState } = simulateStream(initialState, 5 * 60 * 1000, baseTime, 25, true);
    expect(midState.lowScoreConsecutiveMs).toBeGreaterThanOrEqual(300000);

    // Telemetry gap of 20 seconds (> 15s gap limit)
    const gapRes = evaluateAlerts(midState, {
      score: 25,
      isValid: true,
      sessionIsActive: true,
      accumulatedMinutes: 5.3,
      nowMs: baseTime + 5 * 60 * 1000 + 20000, // 20s gap!
    });

    expect(gapRes.nextState.lowScoreConsecutiveMs).toBe(0);
  });

  it("triggers 45-minute study reminder when accumulated active study time reaches 45 minutes", () => {
    const state = createInitialAlertState();

    const res = evaluateAlerts(state, {
      score: 75,
      isValid: true,
      sessionIsActive: true,
      accumulatedMinutes: 45, // Reached 45 mins active study
      nowMs: baseTime,
    });

    expect(res.newAlerts.length).toBe(1);
    expect(res.newAlerts[0].type).toBe("STUDY_REMINDER_45M");
  });

  it("enforces alert cooldown to prevent duplicate popups during active cooldown window", () => {
    const initialState = createInitialAlertState();

    // Simulate 15 minutes of low score ticks
    const { newAlerts } = simulateStream(initialState, 15 * 60 * 1000, baseTime, 25, true);

    // Should trigger exactly 1 alert, and suppress duplicates during 15m cooldown
    expect(newAlerts.length).toBe(1);
    expect(newAlerts[0].type).toBe("BREAK_RECOMMENDED_10M_LOW");
  });
});
