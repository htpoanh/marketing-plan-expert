import { Router, type IRouter } from "express";
import healthRouter from "./health";
import brandsRouter from "./brands";
import reviewsRouter from "./reviews";
import contentRouter from "./content";
import contentPlansRouter from "./content-plans";
import pipelineRouter from "./pipeline";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/brands", brandsRouter);
router.use("/reviews", reviewsRouter);
router.use("/content", contentRouter);
router.use("/content-plans", contentPlansRouter);
router.use("/pipeline", pipelineRouter);

export default router;
