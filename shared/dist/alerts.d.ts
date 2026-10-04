import { SystemAlert } from "./types.js";
export declare const LOW_SCORE_ALERT_THRESHOLD_MS: number;
export declare const STUDY_REMINDER_THRESHOLD_MS: number;
export declare const ALERT_COOLDOWN_MS: number;
export interface AlertEvaluatorState {
    lowScoreConsecutiveMs: number;
    lastReadingTimestampMs: number | null;
    activeSessionStartMs: number | null;
    alerts: SystemAlert[];
}
export declare function createInitialAlertState(): AlertEvaluatorState;
export interface EvaluateAlertsInput {
    score: number | null;
    isValid: boolean;
    sessionIsActive: boolean;
    sessionStartTimeISO?: string;
    nowMs?: number;
}
/**
 * Evaluates alert conditions deterministically.
 * Supports fake clock injection via `nowMs`.
 */
export declare function evaluateAlerts(state: AlertEvaluatorState, input: EvaluateAlertsInput): {
    nextState: AlertEvaluatorState;
    newAlerts: SystemAlert[];
};
