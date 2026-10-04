import http from "http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Server as SocketIOServer } from "socket.io";
import { createInitialAlertState, evaluateAlerts, rankTasks, } from "@biosync/shared";
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
// State
let sessionState = {
    id: `session-${Date.now()}`,
    startTime: new Date().toISOString(),
    isActive: true,
    accumulatedMinutes: 0,
    lowScoreConsecutiveMs: 0,
    activeScenario: "rested",
};
let alertState = createInitialAlertState();
// Load existing session state from DB if available
db.getCurrentSession().then((saved) => {
    if (saved) {
        sessionState = saved;
    }
});
// Broadcast state updates over Socket.io
function broadcastVitals(vitals) {
    io.emit("vitals:update", vitals);
    // Run Alert Evaluation
    const isValid = !vitals.isStale && vitals.quality === "good" && vitals.score !== null;
    const evaluation = evaluateAlerts(alertState, {
        score: vitals.score,
        isValid,
        sessionIsActive: sessionState.isActive,
        sessionStartTimeISO: sessionState.startTime,
        nowMs: Date.now(),
    });
    alertState = evaluation.nextState;
    sessionState.lowScoreConsecutiveMs = alertState.lowScoreConsecutiveMs;
    // Save session state to DB periodically
    db.saveCurrentSession(sessionState).catch(console.error);
    if (evaluation.newAlerts.length > 0) {
        evaluation.newAlerts.forEach((alert) => {
            console.log(`[Alert Triggered] ${alert.title}: ${alert.message}`);
            io.emit("alert:new", alert);
        });
    }
    // Re-broadcast tasks with current energy band
    broadcastTasks();
}
async function broadcastTasks() {
    const tasks = await db.getAllTasks();
    const latestVitals = scoringService.getLatestVitals();
    const band = latestVitals?.band || "UNAVAILABLE";
    const ranked = rankTasks(tasks, band);
    io.emit("tasks:update", { tasks, ranked, band });
}
function broadcastSession() {
    io.emit("session:update", sessionState);
}
// 1. Session Duration Accumulator Tick (runs every 1 sec)
setInterval(() => {
    if (sessionState.isActive) {
        sessionState.accumulatedMinutes += 1 / 60;
        broadcastSession();
    }
}, 1000);
// 2. Start Simulator Stream (runs through exact same processSensorPayload pipeline)
simulatorService.start(2000, (payload) => {
    const result = scoringService.processSensorPayload(payload, sessionState.accumulatedMinutes);
    if (result.vitals) {
        broadcastVitals(result.vitals);
    }
});
// 3. Start MQTT Hardware Ingestion Service
const mqttService = new MqttIngestionService(process.env.MQTT_BROKER_URL || "mqtt://localhost:1883", process.env.MQTT_TOPIC_PREFIX || "biosync", scoringService, (vitals) => {
    broadcastVitals(vitals);
});
mqttService.connect();
// 4. API Routes
app.use("/api/tasks", createTasksRouter(db, scoringService, broadcastTasks));
app.use("/api/session", createSessionsRouter(db, () => sessionState, (updater) => {
    sessionState = updater(sessionState);
    broadcastSession();
}, broadcastSession));
app.use("/api/simulator", createSimulatorRouter(simulatorService, (scenario) => {
    sessionState.activeScenario = scenario;
    broadcastSession();
}));
app.use("/api/recommendations", createRecommendationsRouter(db, scoringService, claudeService, () => sessionState.accumulatedMinutes));
app.get("/api/vitals/history", async (req, res) => {
    try {
        const history = await db.getRecentVitals(50);
        res.json(history);
    }
    catch (err) {
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
    // Send initial data snapshot to newly connected client
    const latestVitals = scoringService.getLatestVitals();
    if (latestVitals) {
        socket.emit("vitals:update", latestVitals);
    }
    const tasks = await db.getAllTasks();
    const band = latestVitals?.band || "UNAVAILABLE";
    const ranked = rankTasks(tasks, band);
    socket.emit("tasks:update", { tasks, ranked, band });
    socket.emit("session:update", sessionState);
    socket.emit("alerts:list", alertState.alerts);
    socket.on("alert:acknowledge", (alertId) => {
        alertState.alerts = alertState.alerts.map((a) => a.id === alertId ? { ...a, acknowledged: true, acknowledgedAt: new Date().toISOString() } : a);
        io.emit("alerts:list", alertState.alerts);
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
    console.log(`Default Simulator active in scenario: '${simulatorService.getScenario()}'`);
    console.log(`=======================================================`);
});
