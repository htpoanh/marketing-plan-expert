import { Router, type IRouter } from "express";
import reportsRouter, { costSummaryHandler } from "./reports.handler";
import modulesRouter from "./modules.handler";

const router: IRouter = Router();

// Module endpoints: POST /ads-strategy/{audience|keywords|performance|trend}
router.use("/", modulesRouter);

// Cost dashboard: GET /ads-strategy/cost-summary
router.get("/cost-summary", costSummaryHandler);

// Reports CRUD: /ads-strategy/reports[/:id]
router.use("/reports", reportsRouter);

export default router;
