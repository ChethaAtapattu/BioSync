import React, { useEffect, useState } from "react";
import { RecommendationResponse } from "@biosync/shared";
import { Bot, RefreshCw, Sparkles } from "lucide-react";

export const RecommendationsCard: React.FC = () => {
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchRecommendation = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/recommendations");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch recommendation:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendation();
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-semibold text-white">Task Schedule Explanation</h2>
        </div>

        <div className="flex items-center space-x-2">
          <span
            className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${
              data?.source === "ai"
                ? "bg-purple-950 text-purple-300 border-purple-700"
                : "bg-slate-800 text-slate-300 border-slate-700"
            }`}
          >
            {data?.source === "ai" ? "CLAUDE AI ADAPTER" : "DETERMINISTIC ENGINE"}
          </span>

          <button
            onClick={fetchRecommendation}
            disabled={loading}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
            title="Refresh Explanation"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>

      {data ? (
        <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 space-y-3">
          <p className="text-xs text-slate-200 leading-relaxed font-normal">{data.advice}</p>

          <div className="border-t border-slate-800/80 pt-2.5 flex items-start space-x-2 text-xs">
            <Bot className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-indigo-300">Suggested Action: </span>
              <span className="text-slate-300">{data.suggestedAction}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-xs text-slate-500">
          Loading task schedule explanation...
        </div>
      )}
    </div>
  );
};
