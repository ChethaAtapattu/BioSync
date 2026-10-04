import React from "react";
import { ProcessedVitals } from "@biosync/shared";
import { Activity, AlertTriangle, Cpu, Radio, ShieldAlert } from "lucide-react";

interface HeaderProps {
  vitals: ProcessedVitals | null;
  isConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({ vitals, isConnected }) => {
  const isSimulated = vitals ? vitals.source === "simulated" : true;
  const isStale = vitals ? vitals.isStale : true;
  const quality = vitals?.quality || "no_contact";

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-4">
        {/* Title & Brand */}
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              BioSync Planner
              <span className="text-xs font-normal text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full">
                MVP Demo
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Experimental ESP32 Biometric Task & Break Recommendation Engine
            </p>
          </div>
        </div>

        {/* Badges Bar */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Prominent Source Badge */}
          <div
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 border shadow-sm ${
              isSimulated
                ? "bg-indigo-950/80 text-indigo-300 border-indigo-700/60"
                : "bg-emerald-950/80 text-emerald-300 border-emerald-700/60"
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>SOURCE: {isSimulated ? "SIMULATED TELEMETRY" : "HARDWARE ESP32"}</span>
          </div>

          {/* Quality Badge */}
          <div
            className={`px-2.5 py-1.5 rounded-lg flex items-center space-x-1 border ${
              quality === "good"
                ? "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                : quality === "warming_up"
                ? "bg-amber-950/60 text-amber-400 border-amber-800"
                : "bg-rose-950/60 text-rose-400 border-rose-800"
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>QUALITY: {quality.toUpperCase()}</span>
          </div>

          {/* Connection Status */}
          <div
            className={`px-2.5 py-1.5 rounded-lg flex items-center space-x-1 border ${
              !isConnected
                ? "bg-rose-950/60 text-rose-400 border-rose-800"
                : isStale
                ? "bg-amber-950/60 text-amber-400 border-amber-800"
                : "bg-slate-800 text-slate-300 border-slate-700"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                !isConnected
                  ? "bg-rose-500"
                  : isStale
                  ? "bg-amber-500 animate-ping"
                  : "bg-emerald-500 animate-pulse"
              }`}
            />
            <span>{!isConnected ? "DISCONNECTED" : isStale ? "STALE (>15s)" : "LIVE STREAM"}</span>
          </div>
        </div>
      </div>

      {/* Mandatory Disclaimer Sub-bar */}
      <div className="bg-slate-950/80 border-t border-slate-800/80 px-4 py-1.5 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        <span>
          <strong>Academic Student Prototype Notice:</strong> Uses experimental biometric indicators to suggest suitable study tasks and breaks. Does not measure cognition, diagnose fatigue, or provide medical advice.
        </span>
      </div>
    </header>
  );
};
