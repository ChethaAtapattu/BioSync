import { Router } from "express";
export function createSessionsRouter(db, getSessionState, updateSessionState, onSessionChanged) {
    const router = Router();
    // GET /api/session
    router.get("/", (req, res) => {
        res.json(getSessionState());
    });
    // POST /api/session/start
    router.post("/start", (req, res) => {
        updateSessionState((prev) => ({
            ...prev,
            isActive: true,
            startTime: prev.startTime || new Date().toISOString(),
        }));
        if (onSessionChanged)
            onSessionChanged();
        res.json(getSessionState());
    });
    // POST /api/session/pause
    router.post("/pause", (req, res) => {
        updateSessionState((prev) => ({
            ...prev,
            isActive: false,
        }));
        if (onSessionChanged)
            onSessionChanged();
        res.json(getSessionState());
    });
    // POST /api/session/reset
    router.post("/reset", (req, res) => {
        updateSessionState((prev) => ({
            ...prev,
            id: `session-${Date.now()}`,
            startTime: new Date().toISOString(),
            endTime: undefined,
            isActive: true,
            accumulatedMinutes: 0,
            lowScoreConsecutiveMs: 0,
        }));
        if (onSessionChanged)
            onSessionChanged();
        res.json(getSessionState());
    });
    return router;
}
