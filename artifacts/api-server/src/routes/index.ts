import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import brandsRouter from "./brands";
import reviewsRouter from "./reviews";
import googleAuthRouter from "./google-auth";
import contentRouter from "./content";
import contentPlansRouter from "./content-plans";
import pipelineRouter from "./pipeline";
import aiAgentsRouter from "./ai-agents";
import aiProfilesRouter from "./ai-profiles";
import automationRouter from "./automation";
import adsStrategyRouter from "./ads-strategy";
import autoReplyRouter from "./auto-reply";
import strategyInboxRouter from "./strategy-inbox";
import trendIntelligenceRouter from "./trend-intelligence";
import brandMemoryRouter from "./brand-memory";
import marketIntelligenceRouter from "./market-intelligence";
import weeklyReportRouter from "./weekly-report";
import adsPerformanceRouter from "./ads-performance";
import contentPipelineRouter from "./content-pipeline";
import virtualKolRouter from "./virtual-kol";
import messengerRouter from "./messenger";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/admin", adminRouter);

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized — please log in" });
}

router.use((req: Request, res: Response, next: NextFunction) => {
  const PUBLIC_PREFIXES = [
    "/healthz",
    "/auth/",
    "/reviews/google-auth/callback",
    // Meta webhook: must be reachable without an admin session. NOT
    // unprotected — the handler verifies Meta's HMAC signature
    // (X-Hub-Signature-256) before doing any work.
    "/messenger/webhook",
  ];
  const isPublic = PUBLIC_PREFIXES.some(p => req.path === p || req.path.startsWith(p));
  if (isPublic) return next();
  return requireAdmin(req, res, next);
});

router.use("/brands", brandsRouter);
router.use("/reviews/google-auth", googleAuthRouter);
router.use("/reviews", reviewsRouter);
router.use("/content", contentRouter);
router.use("/content-plans", contentPlansRouter);
router.use("/pipeline", pipelineRouter);
router.use("/ai-agents", aiAgentsRouter);
router.use("/ai-profiles", aiProfilesRouter);
router.use("/automation", automationRouter);
router.use("/ads-strategy", adsStrategyRouter);
router.use("/auto-reply", autoReplyRouter);
router.use("/strategy-inbox", strategyInboxRouter);
router.use("/trend-intelligence", trendIntelligenceRouter);
router.use("/brand-memory", brandMemoryRouter);
router.use("/market-intelligence", marketIntelligenceRouter);
router.use("/weekly-report", weeklyReportRouter);
router.use("/ads-performance", adsPerformanceRouter);
router.use("/content-pipeline", contentPipelineRouter);
router.use("/virtual-kol", virtualKolRouter);
router.use("/messenger", messengerRouter);

export default router;
