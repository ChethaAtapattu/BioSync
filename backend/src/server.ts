import http from "http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Server as SocketIOServer } from "socket.io";
import {
  createInitialAlertState,
  evaluateAlerts,
  ProcessedVitals,
  rankTasks,
  SensorSource,
  StudySessionState,
} from "@biosync/shared";

import { SqliteDatabaseManager } from "./database/sqliteRepository.js";
import { ScoringService } from "./services/scoringService.js";
import { SimulatorService } from "./services/simulatorService.js";
import { MqttIngestionService } from "./services/mqttService.js";
import { ClaudeRecommendationService } from "./services/claudeService.js";

import { createTasksRouter } from "./routes/tasks.js";
import { createSessionsRouter } from "./routes/sessions.js";
import { createSimulatorRouter } from "./routes/simulator.js";
import { createRecommendationsRouter } from "./routes/recommendations.js";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3001", 10);

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// Database & Core Services
const db = new SqliteDatabaseManager(process.env.DATABASE_FILE || "./biosync.db");
const scoringService = new ScoringService(db);
const simulatorService = new SimulatorService("SIM-ESP32-001");
const claudeService = new ClaudeRecommendationService();

// Session & Alert State
let sessionState: StudySessionState = {
  id: `session-${Date.now()}`,
  startTime: new Date().toISOString(),
  isActive: true,
  accumulatedMinutes: 0,
  lowScoreConsecutiveMs: 0,
  activeScenario: "rested",
  selectedSource: "simulated",
};

let alertState = createInitialAlertState();

// Restore persisted session from DB on startup
db.getCurrentSession().then((saved) => {
  if (saved) {
    sessionState = saved;
    console.log(`[Session Restored] Active: ${sessionState.isActive}, Mins: ${sessionState.accumulatedMinutes.toFixed(1)}, Source: ${sessionState.selectedSource}`);
  }
});

function handleSourceChange(newSource: SensorSource) {
  sessionState.selectedSource = newSource;
  console.log(`[Source Selection Changed] Active telemetry input source set to '${newSource}'`);

  // Reset low-score consecutive timer on source change
  alertState.lowScoreConsecutiveMs = 0;
  sessionState.lowScoreConsecutiveMs = 0;

  // Immediately fetch & broadcast latest vitals for selected source (null if none exist)
  const latestVitals = scoringService.getLatestVitals(newSource);
  io.emit("vitals:update", latestVitals);

  // Immediately re-rank tasks for the new source's band
  broadcastTasks();
  broadcastSession();
}

// Broadcast state updates over Socket.io
function broadcastVitals(vitals: ProcessedVitals) {
  // Only the selected source may update live vitals, task rankings, and alerts!
  if (vitals.source !== sessionState.selectedSource) {
    return;
  }

  io.emit("vitals:update", vitals);

  // Evaluate alerts ONLY when session is active and telemetry is valid
  const isValid = !vitals.isStale && vitals.quality === "good" && vitals.score !== null;
  const evaluation = evaluateAlerts(alertState, {
    score: vitals.score,
    isValid,
    sessionIsActive: sessionState.isActive,
    accumulatedMinutes: sessionState.accumulatedMinutes,
    nowMs: Date.now(),
  });

  alertState = evaluation.nextState;
  sessionState.lowScoreConsecutiveMs = alertState.lowScoreConsecutiveMs;

  db.saveCurrentSession(sessionState).catch(console.error);

  if (evaluation.newAlerts.length > 0) {
    evaluation.newAlerts.forEach((alert) => {
      console.log(`[Alert Triggered] ${alert.title}: ${alert.message}`);
      io.emit("alert:new", alert);
    });
  }

  broadcastTasks();
}

async function broadcastTasks() {
  const tasks = await db.getAllTasks();
  const latestVitals = scoringService.getLatestVitals(sessionState.selectedSource);
  const band = latestVitals?.band || "UNAVAILABLE";
  const ranked = rankTasks(tasks, band);
  io.emit("tasks:update", { tasks, ranked, band, selectedSource: sessionState.selectedSource });
}

function broadcastSession() {
  io.emit("session:update", sessionState);
  db.saveCurrentSession(sessionState).catch(console.error);
}

// 1. Session Duration Accumulator & Stale Telemetry Checker Tick (every 1 second)
setInterval(() => {
  if (sessionState.isActive) {
    sessionState.accumulatedMinutes += 1 / 60;
    broadcastSession();
  }

  // Check stale status for active selected source (15s timeout)
  const latest = scoringService.getLatestVitals(sessionState.selectedSource);
  if (latest && latest.isStale) {
    if (alertState.lowScoreConsecutiveMs !== 0) {
      alertState.lowScoreConsecutiveMs = 0;
      sessionState.lowScoreConsecutiveMs = 0;
    }
    io.emit("vitals:update", latest);
    broadcastTasks();
  }
}, 1000);

// 2. Start Simulator Stream
simulatorService.start(2000, (payload) => {
  const result = scoringService.processSensorPayload(
    payload,
    sessionState.accumulatedMinutes,
    sessionState.selectedSource
  );
  if (result.vitals) {
    broadcastVitals(result.vitals);
  }
});

// 3. Start MQTT Hardware Ingestion Service (Access to selectedSource & accumulatedMinutes)
const mqttService = new MqttIngestionService(
  process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
  process.env.MQTT_TOPIC_PREFIX || "biosync",
  scoringService,
  () => sessionState.selectedSource,
  () => sessionState.accumulatedMinutes,
  (vitals) => {
    broadcastVitals(vitals);
  }
);
mqttService.connect();

// 4. API Routes
app.use(
  "/api/tasks",
  createTasksRouter(db, scoringService, () => sessionState.selectedSource, broadcastTasks)
);

app.use(
  "/api/session",
  createSessionsRouter(
    db,
    () => sessionState,
    (updater) => {
      sessionState = updater(sessionState);
      if (!sessionState.isActive) {
        alertState.lowScoreConsecutiveMs = 0;
        sessionState.lowScoreConsecutiveMs = 0;
      }
      broadcastSession();
    },
    () => {
      alertState = createInitialAlertState();
      sessionState.lowScoreConsecutiveMs = 0;
      io.emit("alerts:list", alertState.alerts);
    },
    handleSourceChange,
    broadcastSession
  )
);

app.use(
  "/api/simulator",
  createSimulatorRouter(simulatorService, (scenario) => {
    sessionState.activeScenario = scenario;
    broadcastSession();
  })
);

app.use(
  "/api/recommendations",
  createRecommendationsRouter(
    db,
    scoringService,
    claudeService,
    () => sessionState.selectedSource,
    () => sessionState.accumulatedMinutes
  )
);

app.get("/api/vitals/history", async (req, res) => {
  try {
    const history = await db.getRecentVitals(50);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    mqtt: mqttService.getStatus(),
    scenario: simulatorService.getScenario(),
    activeSession: sessionState,
  });
});

// 5. Socket.io Event Handling
io.on("connection", async (socket) => {
  console.log(`Socket client connected: ${socket.id}`);

  const latestVitals = scoringService.getLatestVitals(sessionState.selectedSource);
  socket.emit("vitals:update", latestVitals);

  const tasks = await db.getAllTasks();
  const band = latestVitals?.band || "UNAVAILABLE";
  const ranked = rankTasks(tasks, band);
  socket.emit("tasks:update", { tasks, ranked, band, selectedSource: sessionState.selectedSource });
  socket.emit("session:update", sessionState);
  socket.emit("alerts:list", alertState.alerts);

  socket.on("alert:acknowledge", (alertId: string) => {
    alertState.alerts = alertState.alerts.map((a) =>
      a.id === alertId ? { ...a, acknowledged: true, acknowledgedAt: new Date().toISOString() } : a
    );
    io.emit("alerts:list", alertState.alerts);
  });

  socket.on("session:select_source", (source: SensorSource) => {
    if (source === "simulated" || source === "hardware") {
      handleSourceChange(source);
    }
  });

  socket.on("disconnect", () => {
    console.log(`Socket client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`BioSync Backend Server running on http://localhost:${PORT}`);
  console.log(`Socket.io ready on ws://localhost:${PORT}`);
  console.log(`MQTT Ingestion Broker: ${process.env.MQTT_BROKER_URL || "mqtt://localhost:1883"}`);
  console.log(`Active Telemetry Input Source: '${sessionState.selectedSource}'`);
  console.log(`=======================================================`);
});
