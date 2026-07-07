import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pricesRouter from "./prices";
import paywallRouter from "./paywall";
import solanaRouter from "./solana";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pricesRouter);
router.use(paywallRouter);
router.use(solanaRouter);

export default router;
