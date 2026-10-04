import React, { useEffect, useState } from "react";
import { ProcessedVitals } from "@biosync/shared";
import { History, Table } from "lucide-react";

export const SessionHistoryChart: React.FC = () => {
  const [history, setHistory] = useState<ProcessedVitals[]>([]);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/vitals/history");
      if (res.ok) {
        const json = await res.json();
        setHistory(json || []);
      }
    } catch (err) {
      console.error("Failed to fetch vitals history:", err);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <History className="w-5 h-5 text-blue-400" />
          <h2 className="text-base font-semibold text-white">Recent Telemetry Log History</h2>
        </div>
        <span className="text-xs text-slate-400">Last 50 SQLite Log Entries</span>
      </div>

      <div className="overflow-x-auto max-h-[300px] overflow-y-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
            <tr>
              <th className="p-2.5">Time</th>
              <th className="p-2.5">Seq</th>
              <th className="p-2.5">Source</th>
              <th className="p-2.5">HR (BPM)</th>
              <th className="p-2.5">RMSSD (ms)</th>
              <th className="p-2.5">Motion</th>
              <th className="p-2.5">Quality</th>
              <th className="p-2.5">Score</th>
              <th className="p-2.5">Band</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
            {history.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-6 text-slate-500">
                  No telemetry entries logged yet.
                </td>
              </tr>
            ) : (
              history.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40">
                  <td className="p-2.5 font-mono text-[11px]">
                    {new Date(row.receivedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="p-2.5 font-mono">#{row.sequence}</td>
                  <td className="p-2.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${
                        row.source === "simulated"
                          ? "bg-indigo-950 text-indigo-300 border border-indigo-800"
                          : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                      }`}
                    >
                      {row.source}
                    </span>
                  </td>
                  <td className="p-2.5">{row.hrBpm ? Math.round(row.hrBpm) : "--"}</td>
                  <td className="p-2.5">{row.pulseRmssdMs ? row.pulseRmssdMs.toFixed(1) : "--"}</td>
                  <td className="p-2.5">
                    {row.motion !== null ? `${(row.motion * 100).toFixed(0)}%` : "--"}
                  </td>
                  <td className="p-2.5 font-mono text-[10px]">{row.quality}</td>
                  <td className="p-2.5 font-bold">{row.score !== null ? row.score : "--"}</td>
                  <td className="p-2.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 font-semibold border border-slate-700">
                      {row.band}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
