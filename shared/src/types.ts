export type SensorSource = "simulated" | "hardware";

export type SignalQuality = "warming_up" | "good" | "poor" | "no_contact";

export interface SensorPayload {
  deviceId: string;
  sequence: number;
  uptimeMs: number;
  bootId?: string; // Optional boot identifier for reboot detection
  source: SensorSource;
  hrBpm: number | null;
  pulseRmssdMs: number | null;
  motion: number | null;
  quality: SignalQuality;
  focusScore?: number; // Device-supplied focus score (if present, must be ignored)
}

export type EnergyBand = "HIGH" | "MEDIUM" | "LOW" | "BREAK_SUGGESTED" | "UNAVAILABLE";

export interface ProcessedVitals extends SensorPayload {
  receivedAt: string; // ISO 8601 string added by backend
  isStale: boolean;
  score: number | null;
  band: EnergyBand;
  reason?: string;
}

export type TaskDifficulty = 1 | 2 | 3 | 4 | 5;
export type TaskStatus = "pending" | "in_progress" | "completed";

export interface Task {
  id: string;
  title: string;
  description?: string;
  difficulty: TaskDifficulty;
  estimatedMinutes: number;
  deadline: string; // ISO 8601 string
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RankedTask extends Task {
  rank: number;
  scoreWeight: number;
  urgencyWeight: number;
  totalPriority: number;
  reason: string;
  isOverdue: boolean;
  isDueSoon: boolean;
}

export type AlertType = "BREAK_RECOMMENDED_10M_LOW" | "STUDY_REMINDER_45M";

export interface SystemAlert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  cooldownExpiresAt?: string;
}

export interface StudySessionState {
  id: string;
  startTime: string;
  endTime?: string;
  isActive: boolean;
  accumulatedMinutes: number;
  lowScoreConsecutiveMs: number;
  activeScenario: SimulationScenario;
  selectedSource: SensorSource; // Explicit SIMULATED vs HARDWARE input selection
}

export type SimulationScenario =
  | "rested"
  | "elevated_pulse"
  | "prolonged_session"
  | "motion_artifact"
  | "no_finger_contact"
  | "disconnected";

export interface RecommendationResponse {
  source: "ai" | "deterministic";
  advice: string;
  suggestedAction: string;
  confidence: number;
  timestamp: string;
}
