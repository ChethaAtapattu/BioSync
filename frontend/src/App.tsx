import React from "react";
import { useBioSyncSocket } from "./hooks/useBioSyncSocket.js";
import { Header } from "./components/Header.js";
import { VitalsGaugeCard } from "./components/VitalsGaugeCard.js";
import { SessionTracker } from "./components/SessionTracker.js";
import { RecommendationsCard } from "./components/RecommendationsCard.js";
import { TaskPlanner } from "./components/TaskPlanner.js";
import { ScenarioControlPanel } from "./components/ScenarioControlPanel.js";
import { SessionHistoryChart } from "./components/SessionHistoryChart.js";
import { AlertBannerModal } from "./components/AlertBannerModal.js";

export const App: React.FC = () => {
  const {
    isConnected,
    vitals,
    rankedTasks,
    band,
    session,
    alerts,
    acknowledgeAlert,
    refreshTasks,
  } = useBioSyncSocket();

  const selectedSource = session?.selectedSource || "simulated";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-12">
      {/* Sticky Header with explicit source selection toggle */}
      <Header
        vitals={vitals}
        isConnected={isConnected}
        selectedSource={selectedSource}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Top Control Grid: Vitals Gauge, Session Tracker, Task Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <VitalsGaugeCard vitals={vitals} />
          <SessionTracker session={session} />
          <RecommendationsCard />
        </div>

        {/* Task Planner Main Section */}
        <TaskPlanner rankedTasks={rankedTasks} band={band} onRefresh={refreshTasks} />

        {/* Simulator Scenario Control Panel */}
        <ScenarioControlPanel activeScenario={session?.activeScenario || "rested"} />

        {/* Telemetry Log History */}
        <SessionHistoryChart />
      </main>

      {/* Floating System Alerts (Break Recommendations & 45m Study Reminders) */}
      <AlertBannerModal alerts={alerts} onAcknowledge={acknowledgeAlert} />
    </div>
  );
};

export default App;
