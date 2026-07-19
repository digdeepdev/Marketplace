import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pricesRouter from "./prices";
import paywallRouter from "./paywall";
import solanaRouter from "./solana";
import reviewsRouter from "./reviews";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pricesRouter);
router.use(paywallRouter);
router.use(solanaRouter);
router.use(reviewsRouter);

export default router;
