import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import brandsRouter from "./brands";
import reviewsRouter from "./reviews";
import contentRouter from "./content";
import contentPlansRouter from "./content-plans";
import pipelineRouter from "./pipeline";
import aiAgentsRouter from "./ai-agents";
import aiProfilesRouter from "./ai-profiles";
import automationRouter from "./automation";
import adAnalysisRouter from "./ad-analysis";
import messengerRouter from "./messenger";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized — please log in" });
}

router.use("/brands", requireAdmin, brandsRouter);
router.use("/reviews", requireAdmin, reviewsRouter);
router.use("/content", requireAdmin, contentRouter);
router.use("/content-plans", requireAdmin, contentPlansRouter);
router.use("/pipeline", requireAdmin, pipelineRouter);
router.use("/ai-agents", requireAdmin, aiAgentsRouter);
router.use("/ai-profiles", requireAdmin, aiProfilesRouter);
router.use("/automation", requireAdmin, automationRouter);
router.use("/ad-analysis", requireAdmin, adAnalysisRouter);
router.use("/messenger", requireAdmin, messengerRouter);

export default router;
