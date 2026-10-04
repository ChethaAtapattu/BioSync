import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  EnergyBand,
  ProcessedVitals,
  RankedTask,
  StudySessionState,
  SystemAlert,
  Task,
} from "@biosync/shared";

export interface BioSyncSocketData {
  isConnected: boolean;
  vitals: ProcessedVitals | null;
  tasks: Task[];
  rankedTasks: RankedTask[];
  band: EnergyBand;
  session: StudySessionState | null;
  alerts: SystemAlert[];
  acknowledgeAlert: (id: string) => void;
  refreshTasks: () => void;
}

export function useBioSyncSocket(): BioSyncSocketData {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [vitals, setVitals] = useState<ProcessedVitals | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rankedTasks, setRankedTasks] = useState<RankedTask[]>([]);
  const [band, setBand] = useState<EnergyBand>("UNAVAILABLE");
  const [session, setSession] = useState<StudySessionState | null>(null);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);

  useEffect(() => {
    const s = io(window.location.origin, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
    });

    s.on("connect", () => setIsConnected(true));
    s.on("disconnect", () => setIsConnected(false));

    s.on("vitals:update", (data: ProcessedVitals) => setVitals(data));
    s.on("tasks:update", (data: { tasks: Task[]; ranked: RankedTask[]; band: EnergyBand }) => {
      setTasks(data.tasks);
      setRankedTasks(data.ranked);
      setBand(data.band);
    });
    s.on("session:update", (data: StudySessionState) => setSession(data));
    s.on("alerts:list", (data: SystemAlert[]) => setAlerts(data));
    s.on("alert:new", (alert: SystemAlert) => {
      setAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)]);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  const acknowledgeAlert = (id: string) => {
    if (socket) {
      socket.emit("alert:acknowledge", id);
    }
  };

  const refreshTasks = () => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data) => {
        setTasks(data.tasks || []);
        setRankedTasks(data.ranked || []);
        setBand(data.band || "UNAVAILABLE");
      })
      .catch(console.error);
  };

  return {
    isConnected,
    vitals,
    tasks,
    rankedTasks,
    band,
    session,
    alerts,
    acknowledgeAlert,
    refreshTasks,
  };
}
