import { Router } from "express";
import { SimulationScenario } from "@biosync/shared";
import { SimulatorService } from "../services/simulatorService.js";

export function createSimulatorRouter(
  simulatorService: SimulatorService,
  onScenarioChanged?: (scenario: SimulationScenario) => void
): Router {
  const router = Router();

  // GET /api/simulator/scenario
  router.get("/scenario", (req, res) => {
    res.json({ scenario: simulatorService.getScenario() });
  });

  // POST /api/simulator/scenario
  router.post("/scenario", (req, res) => {
    const { scenario } = req.body;
    const validScenarios: SimulationScenario[] = [
      "rested",
      "elevated_pulse",
      "prolonged_session",
      "motion_artifact",
      "no_finger_contact",
      "disconnected",
    ];

    if (!scenario || !validScenarios.includes(scenario)) {
      return res.status(400).json({
        error: `Invalid scenario '${scenario}'. Must be one of: ${validScenarios.join(", ")}`,
      });
    }

    simulatorService.setScenario(scenario);
    if (onScenarioChanged) onScenarioChanged(scenario);

    res.json({ success: true, scenario });
  });

  return router;
}
