import { SystemAlert } from "./types.js";

export const LOW_SCORE_ALERT_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes (600,000 ms)
export const STUDY_REMINDER_THRESHOLD_MS = 45 * 60 * 1000; // 45 minutes
export const ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes cooldown

export interface AlertEvaluatorState {
  lowScoreConsecutiveMs: number;
  lastReadingTimestampMs: number | null;
  activeSessionStartMs: number | null;
  alerts: SystemAlert[];
}

export function createInitialAlertState(): AlertEvaluatorState {
  return {
    lowScoreConsecutiveMs: 0,
    lastReadingTimestampMs: null,
    activeSessionStartMs: null,
    alerts: [],
  };
}

export interface EvaluateAlertsInput {
  score: number | null;
  isValid: boolean; // true if quality == 'good' and not stale and score !== null
  sessionIsActive: boolean;
  sessionStartTimeISO?: string;
  nowMs?: number;
}

/**
 * Evaluates alert conditions deterministically.
 * Supports fake clock injection via `nowMs`.
 */
export function evaluateAlerts(
  state: AlertEvaluatorState,
  input: EvaluateAlertsInput
): { nextState: AlertEvaluatorState; newAlerts: SystemAlert[] } {
  const nowMs = input.nowMs ?? Date.now();
  const nextAlerts = [...state.alerts];
  const newAlerts: SystemAlert[] = [];

  let lowScoreMs = state.lowScoreConsecutiveMs;
  const lastTime = state.lastReadingTimestampMs;

  // 1. Update 10-consecutive-minute low score counter
  if (input.isValid && input.score !== null && input.score < 35) {
    if (lastTime !== null) {
      const delta = Math.max(0, nowMs - lastTime);
      lowScoreMs += delta;
    }
  } else {
    lowScoreMs = 0;
  }

  // 2. Check 10-minute low score break recommendation alert
  const hasLowScoreAlertInCooldown = nextAlerts.some(
    (a) =>
      a.type === "BREAK_RECOMMENDED_10M_LOW" &&
      a.cooldownExpiresAt &&
      new Date(a.cooldownExpiresAt).getTime() > nowMs
  );

  if (lowScoreMs >= LOW_SCORE_ALERT_THRESHOLD_MS && !hasLowScoreAlertInCooldown) {
    const alert: SystemAlert = {
      id: `alert-low-${nowMs}`,
      type: "BREAK_RECOMMENDED_10M_LOW",
      title: "Break Recommendation",
      message:
        "Your Focus Score has remained below 35 for 10 consecutive minutes. Taking a short break is strongly recommended.",
      timestamp: new Date(nowMs).toISOString(),
      acknowledged: false,
      cooldownExpiresAt: new Date(nowMs + ALERT_COOLDOWN_MS).toISOString(),
    };
    newAlerts.push(alert);
    nextAlerts.push(alert);
  }

  // 3. Check 45-minute study reminder alert
  if (input.sessionIsActive && input.sessionStartTimeISO) {
    const sessionStartMs = new Date(input.sessionStartTimeISO).getTime();
    const sessionDurationMs = Math.max(0, nowMs - sessionStartMs);

    const hasStudyReminderInCooldown = nextAlerts.some(
      (a) =>
        a.type === "STUDY_REMINDER_45M" &&
        a.cooldownExpiresAt &&
        new Date(a.cooldownExpiresAt).getTime() > nowMs
    );

    if (sessionDurationMs >= STUDY_REMINDER_THRESHOLD_MS && !hasStudyReminderInCooldown) {
      const alert: SystemAlert = {
        id: `alert-study-${nowMs}`,
        type: "STUDY_REMINDER_45M",
        title: "45-Minute Study Reminder",
        message:
          "You have been studying continuously for 45 minutes! Stand up, stretch, and hydrate.",
        timestamp: new Date(nowMs).toISOString(),
        acknowledged: false,
        cooldownExpiresAt: new Date(nowMs + ALERT_COOLDOWN_MS).toISOString(),
      };
      newAlerts.push(alert);
      nextAlerts.push(alert);
    }
  }

  const nextState: AlertEvaluatorState = {
    lowScoreConsecutiveMs: lowScoreMs,
    lastReadingTimestampMs: nowMs,
    activeSessionStartMs: input.sessionStartTimeISO
      ? new Date(input.sessionStartTimeISO).getTime()
      : null,
    alerts: nextAlerts,
  };

  return { nextState, newAlerts };
}
