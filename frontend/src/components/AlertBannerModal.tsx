import React from "react";
import { SystemAlert } from "@biosync/shared";
import { AlertCircle, Bell, Check, Clock } from "lucide-react";

interface AlertBannerModalProps {
  alerts: SystemAlert[];
  onAcknowledge: (id: string) => void;
}

export const AlertBannerModal: React.FC<AlertBannerModalProps> = ({ alerts, onAcknowledge }) => {
  const unackAlerts = alerts.filter((a) => !a.acknowledged);

  if (unackAlerts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-full space-y-3 px-4 sm:px-0">
      {unackAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`p-4 rounded-2xl border shadow-2xl backdrop-blur-md flex items-start space-x-3 text-xs transition-all animate-bounce ${
            alert.type === "BREAK_RECOMMENDED_10M_LOW"
              ? "bg-rose-950/90 border-rose-700/90 text-rose-100"
              : "bg-amber-950/90 border-amber-700/90 text-amber-100"
          }`}
        >
          {alert.type === "BREAK_RECOMMENDED_10M_LOW" ? (
            <AlertCircle className="w-6 h-6 text-rose-400 flex-shrink-0" />
          ) : (
            <Bell className="w-6 h-6 text-amber-400 flex-shrink-0" />
          )}

          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm">{alert.title}</h4>
              <span className="text-[10px] opacity-75 font-mono">
                {new Date(alert.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="opacity-90 leading-relaxed">{alert.message}</p>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                onClick={() => onAcknowledge(alert.id)}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg font-semibold flex items-center space-x-1 border border-white/20 transition"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Acknowledge & Snooze</span>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
