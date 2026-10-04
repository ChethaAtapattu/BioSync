import React, { useState } from "react";
import { EnergyBand, RankedTask, Task, TaskDifficulty } from "@biosync/shared";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  ListTodo,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { TaskModal } from "./TaskModal.js";

interface TaskPlannerProps {
  rankedTasks: RankedTask[];
  band: EnergyBand;
  onRefresh: () => void;
}

export const TaskPlanner: React.FC<TaskPlannerProps> = ({ rankedTasks, band, onRefresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const toggleTaskStatus = async (task: RankedTask) => {
    const nextStatus =
      task.status === "completed"
        ? "pending"
        : task.status === "pending"
        ? "in_progress"
        : "completed";

    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      onRefresh();
    } catch (err) {
      console.error("Failed to update task status:", err);
    }
  };

  const deleteTask = async (id: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      onRefresh();
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  // Difficulty badge styling
  const renderDifficultyBadge = (difficulty: TaskDifficulty) => {
    let cat = "Easy";
    let colorClass = "bg-emerald-950 text-emerald-400 border-emerald-800";
    if (difficulty === 3) {
      cat = "Medium";
      colorClass = "bg-blue-950 text-blue-400 border-blue-800";
    } else if (difficulty >= 4) {
      cat = "Hard";
      colorClass = "bg-purple-950 text-purple-400 border-purple-800";
    }

    return (
      <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${colorClass}`}>
        Diff {difficulty}/5 ({cat})
      </span>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-5">
      {/* Planner Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-2">
          <ListTodo className="w-5 h-5 text-blue-400" />
          <div>
            <h2 className="text-base font-semibold text-white">Biometric-Ranked Task Schedule</h2>
            <p className="text-xs text-slate-400">
              Tasks ordered by current energy band match ({band}) & deadline urgency
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
      </div>

      {/* Break Recommendation Alert Banner if in BREAK_SUGGESTED */}
      {band === "BREAK_SUGGESTED" && (
        <div className="bg-rose-950/70 border border-rose-700/80 p-3.5 rounded-xl flex items-center space-x-3 text-rose-200 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <div>
            <strong className="font-semibold block text-rose-300">Break Suggested State:</strong>
            Your experimental score is below 35 or fatigue has accumulated. Taking a 10-15 minute break is recommended before resuming heavy tasks.
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {rankedTasks.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            No active tasks found. Click "New Task" above to add your first study task.
          </div>
        ) : (
          rankedTasks.map((task) => (
            <div
              key={task.id}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3.5 ${
                task.status === "completed"
                  ? "bg-slate-950/40 border-slate-800/50 opacity-60"
                  : task.isOverdue
                  ? "bg-rose-950/30 border-rose-800/80"
                  : task.isDueSoon
                  ? "bg-amber-950/20 border-amber-800/70"
                  : "bg-slate-950/70 border-slate-800/80 hover:border-slate-700"
              }`}
            >
              {/* Top Row: Rank badge, title, status, delete */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start space-x-3">
                  {/* Rank circle */}
                  <span className="w-6 h-6 rounded-full bg-blue-900/60 text-blue-300 border border-blue-700/60 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    #{task.rank}
                  </span>
                  <div>
                    <h3
                      className={`text-sm font-semibold text-white ${
                        task.status === "completed" ? "line-through text-slate-400" : ""
                      }`}
                    >
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{task.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  {/* Status button */}
                  <button
                    onClick={() => toggleTaskStatus(task)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border flex items-center space-x-1 transition ${
                      task.status === "completed"
                        ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                        : task.status === "in_progress"
                        ? "bg-blue-950 text-blue-300 border-blue-800"
                        : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{task.status.replace("_", " ").toUpperCase()}</span>
                  </button>

                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition"
                    title="Delete Task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Middle Row: Meta attributes (Difficulty, Estimate, Deadline) */}
              <div className="flex items-center flex-wrap gap-2 text-xs text-slate-400">
                {renderDifficultyBadge(task.difficulty)}

                <span className="flex items-center space-x-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{task.estimatedMinutes}m est.</span>
                </span>

                <span className="flex items-center space-x-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>Due {new Date(task.deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </span>

                {/* Overdue / Due Soon Badges */}
                {task.isOverdue && (
                  <span className="px-2 py-0.5 bg-rose-900/80 text-rose-200 border border-rose-600 rounded font-bold text-[11px] animate-pulse">
                    OVERDUE
                  </span>
                )}
                {task.isDueSoon && !task.isOverdue && (
                  <span className="px-2 py-0.5 bg-amber-900/80 text-amber-200 border border-amber-600 rounded font-semibold text-[11px]">
                    DUE SOON
                  </span>
                )}
              </div>

              {/* Bottom Row: Explicit Human-Readable Reason */}
              <div className="text-[11px] text-blue-300/90 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800/80 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span>
                  <strong>Reason:</strong> {task.reason}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && <TaskModal onClose={() => setIsModalOpen(false)} onSaved={onRefresh} />}
    </div>
  );
};
