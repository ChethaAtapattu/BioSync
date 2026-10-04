import React, { useEffect, useState } from "react";
import { SimulationScenario } from "@biosync/shared";
import { Activity, AlertTriangle, CheckCircle2, Sliders, WifiOff, Zap } from "lucide-react";

interface ScenarioControlPanelProps {
  activeScenario: SimulationScenario;
}

export const ScenarioControlPanel: React.FC<ScenarioControlPanelProps> = ({ activeScenario }) => {
  const [selected, setSelected] = useState<SimulationScenario>(activeScenario || "rested");

  useEffect(() => {
    if (activeScenario) setSelected(activeScenario);
  }, [activeScenario]);

  const switchScenario = async (scenario: SimulationScenario) => {
    setSelected(scenario);
    try {
      await fetch("/api/simulator/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
    } catch (err) {
      console.error("Failed to switch scenario:", err);
    }
  };

  const scenarios: Array<{
    id: SimulationScenario;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
  }> = [
    {
      id: "rested",
      label: "Rested (HIGH Band)",
      description: "HR ~68 BPM, RMSSD ~52ms, Low Motion -> Score ~78",
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
      color: "border-emerald-800 bg-emerald-950/30 text-emerald-300",
    },
    {
      id: "elevated_pulse",
      label: "Elevated Pulse (LOW)",
      description: "HR ~108 BPM, RMSSD ~24ms, Low Motion -> Score ~45",
      icon: <Zap className="w-4 h-4 text-amber-400" />,
      color: "border-amber-800 bg-amber-950/30 text-amber-300",
    },
    {
      id: "prolonged_session",
      label: "Prolonged Fatigue",
      description: "HR ~86 BPM, RMSSD ~18ms, High Effort -> Score <35 (Break)",
      icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,
      color: "border-rose-800 bg-rose-950/30 text-rose-300",
    },
    {
      id: "motion_artifact",
      label: "Motion Artifact (Gated)",
      description: "Motion > 70%, Quality = Poor -> Score = null (UNAVAILABLE)",
      icon: <Activity className="w-4 h-4 text-purple-400" />,
      color: "border-purple-800 bg-purple-950/30 text-purple-300",
    },
    {
      id: "no_finger_contact",
      label: "No Finger Contact",
      description: "Sensor state = no_contact -> Score = null (UNAVAILABLE)",
      icon: <AlertTriangle className="w-4 h-4 text-slate-400" />,
      color: "border-slate-800 bg-slate-950/30 text-slate-300",
    },
    {
      id: "disconnected",
      label: "Disconnected Device",
      description: "Telemetry stream halts -> State stale after 15 seconds",
      icon: <WifiOff className="w-4 h-4 text-rose-500" />,
      color: "border-rose-900 bg-rose-950/50 text-rose-400",
    },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Sliders className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-base font-semibold text-white">
              Simulator Repeatable Scenario Control Panel
            </h2>
            <p className="text-xs text-slate-400">
              Instantly inject simulated sensor states into the backend pipeline for demonstration
            </p>
          </div>
        </div>
        <span className="px-2 py-0.5 text-[11px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-700/60 rounded">
          SIMULATOR ACTIVE
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {scenarios.map((sc) => (
          <button
            key={sc.id}
            onClick={() => switchScenario(sc.id)}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2 ${
              selected === sc.id
                ? `${sc.color} ring-2 ring-indigo-500/60 shadow-lg`
                : "bg-slate-950/50 border-slate-800/80 hover:border-slate-700 text-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs flex items-center space-x-1.5">
                {sc.icon}
                <span>{sc.label}</span>
              </span>
              {selected === sc.id && (
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">{sc.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
};
