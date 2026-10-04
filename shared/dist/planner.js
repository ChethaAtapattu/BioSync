"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDifficultyCategory = getDifficultyCategory;
exports.calculateDeadlineUrgency = calculateDeadlineUrgency;
exports.rankTasks = rankTasks;
/**
 * Groups difficulty rating into categorical buckets.
 */
function getDifficultyCategory(difficulty) {
    if (difficulty <= 2)
        return "easy";
    if (difficulty === 3)
        return "medium";
    return "hard";
}
/**
 * Calculates deadline urgency weight (higher = more urgent).
 * Employs a bounded non-zero formula to prevent division by zero or negative math issues.
 */
function calculateDeadlineUrgency(deadlineISO, nowISO = new Date().toISOString()) {
    const deadlineMs = new Date(deadlineISO).getTime();
    const nowMs = new Date(nowISO).getTime();
    const diffMs = deadlineMs - nowMs;
    const minutesRemaining = diffMs / (1000 * 60);
    let isOverdue = false;
    let isDueSoon = false;
    let urgencyWeight = 0;
    if (minutesRemaining < 0) {
        isOverdue = true;
        // Overdue tasks scale upward boundedly up to 250 points
        const overdueMinutes = Math.abs(minutesRemaining);
        urgencyWeight = 150 + Math.min(100, overdueMinutes / 5);
    }
    else if (minutesRemaining <= 180) {
        // Due within 3 hours (180 mins)
        isDueSoon = true;
        // Bounded curve: 100 points for due right now, decreasing down to 30 points at 180 mins
        urgencyWeight = 30 + Math.max(0, ((180 - minutesRemaining) / 180) * 70);
    }
    else {
        // Due in > 3 hours
        const hoursAway = minutesRemaining / 60;
        urgencyWeight = Math.max(0, 30 - Math.min(25, hoursAway * 0.5));
    }
    return { urgencyWeight, isOverdue, isDueSoon, minutesRemaining };
}
/**
 * Ranks tasks according to biometric energy band suitability and deadline urgency.
 */
function rankTasks(tasks, band, nowISO = new Date().toISOString()) {
    // Exclude completed tasks from active ranking (or keep them at the bottom)
    const activeTasks = tasks.filter((t) => t.status !== "completed");
    const scoredTasks = activeTasks.map((task) => {
        const { urgencyWeight, isOverdue, isDueSoon, minutesRemaining } = calculateDeadlineUrgency(task.deadline, nowISO);
        const diffCat = getDifficultyCategory(task.difficulty);
        let scoreWeight = 0;
        let reasonParts = [];
        // Calculate energy band match weight
        if (band === "HIGH") {
            if (diffCat === "hard") {
                scoreWeight = 80;
                reasonParts.push("Optimal match for HIGH energy band (Hard difficulty 4-5)");
            }
            else if (diffCat === "medium") {
                scoreWeight = 50;
                reasonParts.push("Secondary match for HIGH energy (Medium difficulty 3)");
            }
            else {
                scoreWeight = 20;
                reasonParts.push("Lower priority for HIGH energy (Easy difficulty 1-2)");
            }
        }
        else if (band === "MEDIUM") {
            if (diffCat === "medium") {
                scoreWeight = 80;
                reasonParts.push("Optimal match for MEDIUM energy band (Medium difficulty 3)");
            }
            else if (diffCat === "hard") {
                scoreWeight = 40;
                reasonParts.push("Acceptable for MEDIUM energy (Hard difficulty 4-5)");
            }
            else {
                scoreWeight = 40;
                reasonParts.push("Acceptable for MEDIUM energy (Easy difficulty 1-2)");
            }
        }
        else if (band === "LOW") {
            if (diffCat === "easy") {
                scoreWeight = 80;
                reasonParts.push("Optimal match for LOW energy band (Easy difficulty 1-2)");
            }
            else if (diffCat === "medium") {
                scoreWeight = 45;
                reasonParts.push("Moderate match for LOW energy (Medium difficulty 3)");
            }
            else {
                scoreWeight = 10;
                reasonParts.push("De-prioritized for LOW energy (Hard difficulty 4-5)");
            }
        }
        else if (band === "BREAK_SUGGESTED") {
            scoreWeight = 30;
            reasonParts.push("Break suggested before tackling task");
        }
        else {
            // UNAVAILABLE
            scoreWeight = 0;
            reasonParts.push("Biometric score unavailable — ranked by deadline urgency");
        }
        // Urgency override descriptions
        if (isOverdue) {
            const overdueMins = Math.abs(Math.round(minutesRemaining));
            reasonParts.unshift(`[OVERDUE by ${overdueMins}m] High priority boost`);
        }
        else if (isDueSoon) {
            const remainingMins = Math.round(minutesRemaining);
            reasonParts.unshift(`[DUE SOON in ${remainingMins}m] Priority elevated`);
        }
        const totalPriority = scoreWeight + urgencyWeight;
        const reason = reasonParts.join(" • ");
        return {
            ...task,
            rank: 0, // Assigned after sorting
            scoreWeight,
            urgencyWeight,
            totalPriority,
            reason,
            isOverdue,
            isDueSoon,
        };
    });
    // Stable sort:
    // 1. totalPriority descending
    // 2. deadline ascending
    // 3. title/id ascending for deterministic stability
    scoredTasks.sort((a, b) => {
        if (b.totalPriority !== a.totalPriority) {
            return b.totalPriority - a.totalPriority;
        }
        const deadlineDiff = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        if (deadlineDiff !== 0)
            return deadlineDiff;
        return a.id.localeCompare(b.id);
    });
    // Assign 1-indexed ranks
    return scoredTasks.map((task, index) => ({
        ...task,
        rank: index + 1,
    }));
}
