# BioSync Planner — 3-Minute Demonstrator & Evaluator Guide

Use this step-by-step walkthrough to present the **BioSync Planner MVP** to course evaluators, professors, or lab partners.

---

## 1. Project Purpose & Academic Boundaries (0:00 - 0:30)

1. Open the BioSync Dashboard at `http://localhost:3000`.
2. Point out the top header disclaimer:
   > *"Uses experimental biometric indicators to suggest suitable study tasks and breaks. Does not measure cognition, diagnose fatigue, or provide medical advice."*
3. Highlight the **Sensor Source Badge**:
   - Note the prominent **`[SOURCE: SIMULATED TELEMETRY]`** (or **`[SOURCE: HARDWARE ESP32]`**) badge in the top right.

---

## 2. Sensor Telemetry & Focus Score Heuristic (0:30 - 1:15)

1. Direct attention to the **Focus Score & Energy Band Card**:
   - Explain the provisional heuristic formula:
     $$\text{hrvNorm} = \text{clamp}\left(\frac{\text{pulseRmssdMs} - 8}{52}, 0, 1\right)$$
     $$\text{hrNorm} = \text{clamp}\left(\frac{110 - \text{hrBpm}}{55}, 0, 1\right)$$
     $$\text{base} = 100 \times (0.6 \cdot \text{hrvNorm} + 0.4 \cdot \text{hrNorm})$$
     $$\text{penalty} = \min\left(20, \max(0, \text{sessionMinutes} - 90) \times 0.3\right)$$
2. Show the active **Energy Band**:
   - `HIGH` ($\ge 70$), `MEDIUM` ($\ge 50$), `LOW` ($\ge 35$), `BREAK_SUGGESTED` ($< 35$), or `UNAVAILABLE`.

---

## 3. Demonstrating Scenario Controls (1:15 - 2:00)

Scroll down to the **Simulator Scenario Control Panel** and click through the repeatable scenarios:

1. **Click `Rested (HIGH Band)`**:
   - Score jumps to $\sim 78$ (`HIGH`).
   - Observe the **Task Schedule**: Hard difficulty tasks (e.g., *Implement MPU6050 Filter*, 5/5) automatically move to Rank #1 with reason: `"Optimal match for HIGH energy band (Hard difficulty 4-5)"`.
2. **Click `Elevated Pulse (LOW)`**:
   - Score drops to $\sim 45$ (`LOW`).
   - Observe the **Task Schedule**: Easy difficulty tasks (e.g., *Clear Workbench*, 1/5) move to Rank #1.
3. **Click `Motion Artifact (Gated)`**:
   - Motion jumps to $78\%$, Quality becomes `POOR`.
   - Score becomes `null` (`UNAVAILABLE`). Motion is correctly treated as a **signal quality gate**, not a concentration reward!
   - Task planner switches to fallback ranking strictly by **deadline urgency**.
4. **Click `Disconnected Device`**:
   - Stream pauses. After 15 seconds, state switches to **`STALE (>15s)`** and score resets to `null`.

---

## 4. Break Alerts & Task Explanation (2:00 - 3:00)

1. **Click `Prolonged Fatigue`**:
   - Score stays below 35 (`BREAK_SUGGESTED`).
   - Observe the floating **Break Recommendation Popup** warning that low score has persisted for continuous study effort.
   - Click **`Acknowledge & Snooze`** to demonstrate alert cooldown.
2. **Task Schedule Explanation**:
   - Review the **Recommendations Card** at the top right.
   - Show how it displays rule-based advice or optional Claude AI schedule explanations with clear, transparent reasoning.

---

## 5. Summary of Implementation Artifacts

- **SQLite Database**: Tasks and sessions persist across backend restarts (`biosync.db`).
- **Data Contract**: Exact same payload JSON contract shared between hardware firmware MQTT and the simulated sensor engine.
