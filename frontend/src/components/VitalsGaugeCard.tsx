import React from "react";
import { ProcessedVitals } from "@biosync/shared";
import { Activity, AlertCircle, Gauge, Heart, Zap } from "lucide-react";

interface VitalsGaugeCardProps {
  vitals: ProcessedVitals | null;
}

export const VitalsGaugeCard: React.FC<VitalsGaugeCardProps> = ({ vitals }) => {
  const isStale = vitals?.isStale ?? true;
  const score = isStale ? null : vitals?.score ?? null;
  const band = isStale ? "UNAVAILABLE" : vitals?.band || "UNAVAILABLE";
  const hrBpm = vitals?.hrBpm ?? null;
  const pulseRmssdMs = vitals?.pulseRmssdMs ?? null;
  const motion = vitals?.motion ?? null;

  // Band color helpers
  const getBandBadgeClass = () => {
    switch (band) {
      case "HIGH":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-600/60";
      case "MEDIUM":
        return "bg-blue-950/80 text-blue-300 border-blue-600/60";
      case "LOW":
        return "bg-amber-950/80 text-amber-300 border-amber-600/60";
      case "BREAK_SUGGESTED":
        return "bg-rose-950/80 text-rose-300 border-rose-600/60";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-6">
      {/* Top Section: Score Gauge */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Gauge className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-semibold text-white">Focus Score & Energy Band</h2>
          </div>
          <span
            className={`px-3 py-1 text-xs font-bold rounded-full border shadow-sm ${getBandBadgeClass()}`}
          >
            BAND: {band}
          </span>
        </div>

        {/* Score Value Display */}
        <div className="flex items-baseline space-x-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          <div className="text-4xl font-extrabold text-white tracking-tight">
            {score !== null ? score : "--"}
          </div>
          <div className="text-xs text-slate-400">
            {score !== null ? "/ 100 Experimental Score" : "Score Unavailable (Data Invalid/Stale)"}
          </div>
        </div>

        {/* Progress Score Bar */}
        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden mt-3">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              score === null
                ? "bg-slate-700 w-0"
                : score >= 70
                ? "bg-emerald-500"
                : score >= 50
                ? "bg-blue-500"
                : score >= 35
                ? "bg-amber-500"
                : "bg-rose-500 animate-pulse"
            }`}
            style={{ width: `${score ?? 0}%` }}
          />
        </div>

        {/* Reason / Status Text */}
        <p className="text-xs text-slate-400 mt-2.5 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
          <span>{vitals?.reason || "Awaiting sensor telemetry stream..."}</span>
        </p>
      </div>

      {/* Grid of Raw Vitals */}
      <div className="grid grid-cols-3 gap-3">
        {/* Heart Rate */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Heart Rate</span>
            <Heart className={`w-4 h-4 text-rose-500 ${hrBpm ? "animate-heart-pulse" : ""}`} />
          </div>
          <div className="text-xl font-bold text-white">
            {hrBpm !== null ? `${Math.round(hrBpm)}` : "--"}
            <span className="text-xs font-normal text-slate-400 ml-1">BPM</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">MAX30102 Optical</span>
        </div>

        {/* Pulse RMSSD (HRV) */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Pulse RMSSD</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-white">
            {pulseRmssdMs !== null ? `${pulseRmssdMs.toFixed(1)}` : "--"}
            <span className="text-xs font-normal text-slate-400 ml-1">ms</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">60s Rolling Window</span>
        </div>

        {/* Motion Level */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Motion Gate</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-white">
            {motion !== null ? `${(motion * 100).toFixed(0)}%` : "--"}
          </div>
          <span className="text-[10px] text-slate-500 mt-1">
            {motion !== null && motion > 0.45 ? "High (Gated)" : "Normal (<45%)"}
          </span>
        </div>
      </div>
    </div>
  );
};
