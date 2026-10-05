"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACCEPTABLE_TELEMETRY_GAP_MS = exports.ALERT_COOLDOWN_MS = exports.STUDY_REMINDER_THRESHOLD_MS = exports.LOW_SCORE_ALERT_THRESHOLD_MS = void 0;
exports.createInitialAlertState = createInitialAlertState;
exports.evaluateAlerts = evaluateAlerts;
exports.LOW_SCORE_ALERT_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes (600,000 ms)
exports.STUDY_REMINDER_THRESHOLD_MS = 45 * 60 * 1000; // 45 minutes (2,700,000 ms)
exports.ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes cooldown
exports.ACCEPTABLE_TELEMETRY_GAP_MS = 15000; // 15 seconds max allowed gap between readings
function createInitialAlertState() {
    return {
        lowScoreConsecutiveMs: 0,
        lastReadingTimestampMs: null,
        alerts: [],
    };
}
/**
 * Evaluates alert conditions deterministically.
 * - Counts consecutive valid low readings ONLY while session is active.
 * - Pauses/resets or telemetry gaps > 15s interrupt and reset the 10-minute timer.
 * - Uses accumulated active study time for the 45-minute reminder.
 */
function evaluateAlerts(state, input) {
    const nowMs = input.nowMs ?? Date.now();
    const nextAlerts = [...state.alerts];
    const newAlerts = [];
    let lowScoreMs = state.lowScoreConsecutiveMs;
    const lastTime = state.lastReadingTimestampMs;
    // 1. Session state & Telemetry Gap Check
    const gapMs = lastTime !== null ? Math.max(0, nowMs - lastTime) : 0;
    const isTelemetryGapAcceptable = lastTime === null || gapMs <= exports.ACCEPTABLE_TELEMETRY_GAP_MS;
    // Alert condition: session must be active, data valid, score < 35, and gap <= 15s
    if (input.sessionIsActive && input.isValid && input.score !== null && input.score < 35 && isTelemetryGapAcceptable) {
        if (lastTime !== null) {
            lowScoreMs += gapMs;
        }
    }
    else {
        // Inactive session, invalid reading, score >= 35, or telemetry gap > 15s INTERRUPTS and resets timer!
        lowScoreMs = 0;
    }
    // 2. Check 10-consecutive-minute low score break recommendation alert
    const hasLowScoreAlertInCooldown = nextAlerts.some((a) => a.type === "BREAK_RECOMMENDED_10M_LOW" &&
        a.cooldownExpiresAt &&
        new Date(a.cooldownExpiresAt).getTime() > nowMs);
    if (lowScoreMs >= exports.LOW_SCORE_ALERT_THRESHOLD_MS && !hasLowScoreAlertInCooldown) {
        const alert = {
            id: `alert-low-${nowMs}`,
            type: "BREAK_RECOMMENDED_10M_LOW",
            title: "Break Recommendation",
            message: "Your Focus Score has remained below 35 for 10 consecutive minutes of active study. Taking a short break is strongly recommended.",
            timestamp: new Date(nowMs).toISOString(),
            acknowledged: false,
            cooldownExpiresAt: new Date(nowMs + exports.ALERT_COOLDOWN_MS).toISOString(),
        };
        newAlerts.push(alert);
        nextAlerts.push(alert);
    }
    // 3. Check 45-minute active study reminder alert (using accumulated active study time)
    if (input.sessionIsActive) {
        const accumulatedMs = input.accumulatedMinutes * 60 * 1000;
        const hasStudyReminderInCooldown = nextAlerts.some((a) => a.type === "STUDY_REMINDER_45M" &&
            a.cooldownExpiresAt &&
            new Date(a.cooldownExpiresAt).getTime() > nowMs);
        if (accumulatedMs >= exports.STUDY_REMINDER_THRESHOLD_MS && !hasStudyReminderInCooldown) {
            const alert = {
                id: `alert-study-${nowMs}`,
                type: "STUDY_REMINDER_45M",
                title: "45-Minute Study Reminder",
                message: "You have accumulated 45 minutes of active study time! Stand up, stretch, and hydrate.",
                timestamp: new Date(nowMs).toISOString(),
                acknowledged: false,
                cooldownExpiresAt: new Date(nowMs + exports.ALERT_COOLDOWN_MS).toISOString(),
            };
            newAlerts.push(alert);
            nextAlerts.push(alert);
        }
    }
    const nextState = {
        lowScoreConsecutiveMs: lowScoreMs,
        lastReadingTimestampMs: nowMs,
        alerts: nextAlerts,
    };
    return { nextState, newAlerts };
}
