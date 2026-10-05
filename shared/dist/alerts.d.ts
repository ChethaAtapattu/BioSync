import { SystemAlert } from "./types.js";
export declare const LOW_SCORE_ALERT_THRESHOLD_MS: number;
export declare const STUDY_REMINDER_THRESHOLD_MS: number;
export declare const ALERT_COOLDOWN_MS: number;
export declare const ACCEPTABLE_TELEMETRY_GAP_MS = 15000;
export interface AlertEvaluatorState {
    lowScoreConsecutiveMs: number;
    lastReadingTimestampMs: number | null;
    alerts: SystemAlert[];
}
export declare function createInitialAlertState(): AlertEvaluatorState;
export interface EvaluateAlertsInput {
    score: number | null;
    isValid: boolean;
    sessionIsActive: boolean;
    accumulatedMinutes: number;
    nowMs?: number;
}
/**
 * Evaluates alert conditions deterministically.
 * - Counts consecutive valid low readings ONLY while session is active.
 * - Pauses/resets or telemetry gaps > 15s interrupt and reset the 10-minute timer.
 * - Uses accumulated active study time for the 45-minute reminder.
 */
export declare function evaluateAlerts(state: AlertEvaluatorState, input: EvaluateAlertsInput): {
    nextState: AlertEvaluatorState;
    newAlerts: SystemAlert[];
};
