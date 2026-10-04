import Anthropic from "@anthropic-ai/sdk";
import { EnergyBand, RankedTask, RecommendationResponse } from "@biosync/shared";

export class ClaudeRecommendationService {
  private anthropic: Anthropic | null = null;
  private model: string;
  private timeoutMs: number;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";
    this.timeoutMs = parseInt(process.env.CLAUDE_TIMEOUT_MS || "5000", 10);

    if (apiKey && apiKey.trim().length > 0) {
      this.anthropic = new Anthropic({ apiKey });
      console.log("Claude API client initialized for AI recommendations.");
    } else {
      console.log("No ANTHROPIC_API_KEY found — system defaulting to deterministic recommendations.");
    }
  }

  /**
   * Generates task schedule explanation & recommendations.
   * Uses Anthropic Claude if key is provided and request succeeds within timeout;
   * otherwise falls back seamlessly to deterministic rule-based advice.
   */
  public async getRecommendation(
    band: EnergyBand,
    score: number | null,
    topTasks: RankedTask[],
    sessionMinutes: number
  ): Promise<RecommendationResponse> {
    if (!this.anthropic) {
      return this.getDeterministicFallback(band, score, topTasks, sessionMinutes);
    }

    try {
      const prompt = `You are BioSync Planner, an intelligent academic productivity coach for an embedded biosensor student project.
You must NEVER claim to measure cognition, diagnose fatigue, or provide medical advice.
Your task is to explain the current task ranking based on experimental HRV/HR indicators.

Current State:
- Energy Band: ${band}
- Focus Score: ${score !== null ? `${score}/100` : "Unavailable"}
- Active Session Duration: ${Math.round(sessionMinutes)} minutes
- Top Ranked Tasks:
${topTasks.map((t) => `  * [Rank ${t.rank}] ${t.title} (Diff: ${t.difficulty}/5, Est: ${t.estimatedMinutes}m, Deadline: ${t.deadline}) -> Reason: ${t.reason}`).join("\n")}

Respond ONLY with a valid JSON object matching this schema:
{
  "advice": "Clear 2-sentence explanation of why the top task fits the current energy state",
  "suggestedAction": "1 concise action step for the student",
  "confidence": 0.95
}`;

      // Enforce timeout via Promise.race
      const apiCall = this.anthropic.messages.create({
        model: this.model,
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Claude API request timed out")), this.timeoutMs)
      );

      const response: any = await Promise.race([apiCall, timeoutPromise]);
      const contentText = response.content[0]?.text || "";

      // Validate JSON response
      const parsed = JSON.parse(contentText);
      if (parsed.advice && parsed.suggestedAction) {
        return {
          source: "ai",
          advice: parsed.advice,
          suggestedAction: parsed.suggestedAction,
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.9,
          timestamp: new Date().toISOString(),
        };
      }

      throw new Error("Invalid schema returned by Claude API");
    } catch (err: any) {
      console.warn(`[Claude Fallback] ${err.message}. Falling back to deterministic rules.`);
      return this.getDeterministicFallback(band, score, topTasks, sessionMinutes);
    }
  }

  /**
   * Deterministic rule-based fallback recommendation generator.
   */
  public getDeterministicFallback(
    band: EnergyBand,
    score: number | null,
    topTasks: RankedTask[],
    sessionMinutes: number
  ): RecommendationResponse {
    const topTask = topTasks[0];
    let advice = "";
    let suggestedAction = "";

    if (band === "HIGH") {
      advice = `Your experimental biometric indicators reflect strong baseline stability (${score ?? 75}/100). High energy bands are ideal for tackling demanding, high-difficulty technical tasks.`;
      suggestedAction = topTask
        ? `Begin working on "${topTask.title}" (${topTask.estimatedMinutes}m estimate).`
        : "Add a high-difficulty task to your planner.";
    } else if (band === "MEDIUM") {
      advice = `Biometric indicators show steady baseline energy (${score ?? 55}/100). Balanced for steady-state workflow and moderate technical tasks.`;
      suggestedAction = topTask
        ? `Focus on "${topTask.title}" for the next ${topTask.estimatedMinutes} minutes.`
        : "Select a medium-difficulty task to maintain progress.";
    } else if (band === "LOW") {
      advice = `Biometric indicators indicate lower HRV/HR baseline (${score ?? 40}/100). Prioritize lighter administrative or quick easy tasks to reduce fatigue build-up.`;
      suggestedAction = topTask
        ? `Complete light task "${topTask.title}" or take a short pause.`
        : "Switch to easy difficulty tasks.";
    } else if (band === "BREAK_SUGGESTED") {
      advice = `Continuous study effort (${Math.round(sessionMinutes)}m) or low experimental score (<35) suggests diminished returns. Rest recovers focus.`;
      suggestedAction = "Step away for a 10-15 minute physical break, stretch, and hydrate.";
    } else {
      advice = "Biometric signal unavailable or warming up. Tasks are currently ranked strictly by deadline urgency.";
      suggestedAction = topTask
        ? `Focus on nearest deadline: "${topTask.title}".`
        : "Create your first study task in the planner.";
    }

    return {
      source: "deterministic",
      advice,
      suggestedAction,
      confidence: 1.0,
      timestamp: new Date().toISOString(),
    };
  }
}
