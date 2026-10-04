import React from "react";
import { StudySessionState } from "@biosync/shared";
import { Clock, Pause, Play, RotateCcw, ShieldAlert } from "lucide-react";

interface SessionTrackerProps {
  session: StudySessionState | null;
  onRefresh?: () => void;
}

export const SessionTracker: React.FC<SessionTrackerProps> = ({ session }) => {
  const accumulatedMins = session?.accumulatedMinutes ?? 0;
  const hours = Math.floor(accumulatedMins / 60);
  const mins = Math.floor(accumulatedMins % 60);
  const secs = Math.floor((accumulatedMins * 60) % 60);
  const isActive = session?.isActive ?? false;

  const lowScoreMs = session?.lowScoreConsecutiveMs ?? 0;
  const lowScoreMins = (lowScoreMs / 60000).toFixed(1);
  const lowScoreProgress = Math.min(100, (lowScoreMs / 600000) * 100);

  const handleAction = async (action: "start" | "pause" | "reset") => {
    try {
      await fetch(`/api/session/${action}`, { method: "POST" });
    } catch (err) {
      console.error(`Failed session action ${action}:`, err);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Clock className="w-5 h-5 text-blue-400" />
          <h2 className="text-base font-semibold text-white">Study Session Tracker</h2>
        </div>
        <span
          className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
            isActive
              ? "bg-emerald-950 text-emerald-400 border-emerald-800"
              : "bg-slate-800 text-slate-400 border-slate-700"
          }`}
        >
          {isActive ? "ACTIVE SESSION" : "PAUSED"}
        </span>
      </div>

      {/* Big Timer */}
      <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-400">Total Active Study Duration</div>
          <div className="text-3xl font-extrabold text-white font-mono tracking-wider mt-1">
            {String(hours).padStart(2, "0")}:{String(mins).padStart(2, "0")}:
            {String(secs).padStart(2, "0")}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center space-x-2">
          {!isActive ? (
            <button
              onClick={() => handleAction("start")}
              className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow transition"
              title="Start Study Session"
            >
              <Play className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => handleAction("pause")}
              className="p-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl shadow transition"
              title="Pause Session"
            >
              <Pause className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={() => handleAction("reset")}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            title="Reset Session"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Low-Score Continuous Timer Tracker */}
      <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/60 text-xs">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="flex items-center space-x-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Consecutive Low-Score Window (&lt;35)</span>
          </span>
          <span className="font-mono text-slate-300">{lowScoreMins} / 10.0 mins</span>
        </div>
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-rose-500 transition-all duration-300 rounded-full"
            style={{ width: `${lowScoreProgress}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-500 mt-1">
          Invalid/null readings interrupt and reset this 10-minute window automatically.
        </p>
      </div>
    </div>
  );
};
