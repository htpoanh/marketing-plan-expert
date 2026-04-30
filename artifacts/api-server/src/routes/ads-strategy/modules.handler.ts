/**
 * Module endpoint stubs for Phase 1.
 *
 * Each of these endpoints will, in Phase 2/3, call the relevant AI provider
 * (Claude/Gemini/OpenAI/Grok), validate the response with Zod, persist to
 * `ads_reports`, and return the saved row.
 *
 * For Phase 1 they return 501 Not Implemented so the OpenAPI surface and
 * generated React hooks already exist (frontend can be scaffolded against
 * them, tests can target the route shape) without executing any AI calls.
 */
import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

function notImplemented(moduleName: string) {
  return (_req: Request, res: Response) => {
    res.status(501).json({
      error: `Module '${moduleName}' is not yet implemented (Phase 2). The endpoint and schema exist; the AI integration will be wired up next.`,
    });
  };
}

router.post("/audience", notImplemented("audience"));
router.post("/keywords", notImplemented("keyword"));
router.post("/performance", notImplemented("performance"));
router.post("/trend", notImplemented("trend"));

export default router;
