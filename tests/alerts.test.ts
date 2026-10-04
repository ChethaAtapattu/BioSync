import { describe, expect, it } from "vitest";
import { createInitialAlertState, evaluateAlerts } from "../shared/src/alerts.js";

describe("System Alert Evaluator (Fake Clock Verification)", () => {
  const baseTime = 1759650000000; // Fixed epoch timestamp in ms

  it("triggers Break Recommendation after 10 consecutive minutes of valid low score (<35)", () => {
    let state = createInitialAlertState();

    // 1. Initial valid low score tick at T=0
    let res = evaluateAlerts(state, {
      score: 30,
      isValid: true,
      sessionIsActive: true,
      nowMs: baseTime,
    });
    state = res.nextState;
    expect(res.newAlerts.length).toBe(0);

    // 2. Advance fake clock by 5 minutes (300,000 ms) with low score
    res = evaluateAlerts(state, {
      score: 28,
      isValid: true,
      sessionIsActive: true,
      nowMs: baseTime + 5 * 60 * 1000,
    });
    state = res.nextState;
    expect(res.newAlerts.length).toBe(0);
    expect(state.lowScoreConsecutiveMs).toBe(300000);

    // 3. Advance fake clock to 10 minutes total (600,000 ms) with low score
    res = evaluateAlerts(state, {
      score: 25,
      isValid: true,
      sessionIsActive: true,
      nowMs: baseTime + 10 * 60 * 1000,
    });
    state = res.nextState;
    expect(res.newAlerts.length).toBe(1);
    expect(res.newAlerts[0].type).toBe("BREAK_RECOMMENDED_10M_LOW");
  });

  it("resets 10-consecutive-minute accumulator when invalid/null reading interrupts", () => {
    let state = createInitialAlertState();

    // Tick for 5 minutes
    let res = evaluateAlerts(state, {
      score: 25,
      isValid: true,
      sessionIsActive: true,
      nowMs: baseTime,
    });
    state = res.nextState;

    res = evaluateAlerts(state, {
      score: 25,
      isValid: true,
      sessionIsActive: true,
      nowMs: baseTime + 5 * 60 * 1000,
    });
    state = res.nextState;
    expect(state.lowScoreConsecutiveMs).toBe(300000);

    // Interruption! Motion artifact or no finger contact (isValid = false)
    res = evaluateAlerts(state, {
      score: null,
      isValid: false,
      sessionIsActive: true,
      nowMs: baseTime + 5 * 60 * 1000 + 5000,
    });
    state = res.nextState;

    // Consecutive timer must reset to 0!
    expect(state.lowScoreConsecutiveMs).toBe(0);
  });

  it("triggers 45-minute study reminder when active session reaches 45 minutes", () => {
    let state = createInitialAlertState();
    const sessionStart = new Date(baseTime).toISOString();

    const res = evaluateAlerts(state, {
      score: 75,
      isValid: true,
      sessionIsActive: true,
      sessionStartTimeISO: sessionStart,
      nowMs: baseTime + 45 * 60 * 1000,
    });

    expect(res.newAlerts.length).toBe(1);
    expect(res.newAlerts[0].type).toBe("STUDY_REMINDER_45M");
  });

  it("enforces alert cooldown to prevent duplicate popups during active cooldown window", () => {
    let state = createInitialAlertState();

    // Initial tick at T=0
    let res = evaluateAlerts(state, {
      score: 20,
      isValid: true,
      sessionIsActive: true,
      nowMs: baseTime,
    });
    state = res.nextState;

    // Advance 10 minutes to trigger alert at T=10m
    res = evaluateAlerts(state, {
      score: 20,
      isValid: true,
      sessionIsActive: true,
      nowMs: baseTime + 10 * 60 * 1000,
    });
    state = res.nextState;
    expect(res.newAlerts.length).toBe(1);

    // Another tick 1 minute later during 15m cooldown -> no new duplicate alert
    res = evaluateAlerts(state, {
      score: 20,
      isValid: true,
      sessionIsActive: true,
      nowMs: baseTime + 11 * 60 * 1000,
    });
    expect(res.newAlerts.length).toBe(0);
  });
});
