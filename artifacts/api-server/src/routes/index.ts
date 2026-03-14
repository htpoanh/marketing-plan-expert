import { Router, type IRouter } from "express";
import healthRouter from "./health";
import brandsRouter from "./brands";
import reviewsRouter from "./reviews";
import contentRouter from "./content";
import contentPlansRouter from "./content-plans";
import pipelineRouter from "./pipeline";
import aiAgentsRouter from "./ai-agents";
import aiProfilesRouter from "./ai-profiles";
import automationRouter from "./automation";
import adAnalysisRouter from "./ad-analysis";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/brands", brandsRouter);
router.use("/reviews", reviewsRouter);
router.use("/content", contentRouter);
router.use("/content-plans", contentPlansRouter);
router.use("/pipeline", pipelineRouter);
router.use("/ai-agents", aiAgentsRouter);
router.use("/ai-profiles", aiProfilesRouter);
router.use("/automation", automationRouter);
router.use("/ad-analysis", adAnalysisRouter);

export default router;
