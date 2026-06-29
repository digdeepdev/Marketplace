import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";

const router: IRouter = Router();

const GetVerseNairaRateResponse = z.object({
  versePerNaira: z.number(),
  nairaPerVerse: z.number(),
  verseUsd: z.number(),
  usdtNgn: z.number(),
  cachedAt: z.coerce.date(),
  feePercent: z.number(),
  versePerNairaWithFee: z.number(),
});

const TokenRateSchema = z.object({
  tokenPerNaira: z.number(),
  nairaPerToken: z.number(),
  feePercent: z.number(),
});

const GetAllRatesResponse = z.object({
  verse: TokenRateSchema,
  usdt: TokenRateSchema,
  sol: TokenRateSchema,
  ecash: TokenRateSchema,
  cachedAt: z.coerce.date(),
});

export type TokenRate = z.infer<typeof TokenRateSchema>;
export type AllRates = z.infer<typeof GetAllRatesResponse>;

const VERSE_COIN_ID = "verse-bitcoin";
const CACHE_TTL_MS = 60_000;
const FEE_PERCENT = 2;

interface UnifiedCache {
  verseUsd: number;
  solUsd: number;
  xecUsd: number;
  usdtNgn: number;
  fetchedAt: number;
}

let cache: UnifiedCache | null = null;
let inFlight: Promise<UnifiedCache> | null = null;

async function fetchUnified(): Promise<UnifiedCache> {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${VERSE_COIN_ID},tether,solana,ecash&vs_currencies=usd,ngn`,
  );
  if (!res.ok) throw new Error(`CoinGecko simple/price fetch failed: HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, Record<string, number>>;

  const verseUsd = data[VERSE_COIN_ID]?.usd;
  const usdtNgn = data["tether"]?.ngn;
  const solUsd = data["solana"]?.usd;
  const xecUsd = data["ecash"]?.usd;

  if (!verseUsd) throw new Error("Missing VERSE/USD rate");
  if (!usdtNgn) throw new Error("Missing USDT/NGN rate");
  if (!solUsd) throw new Error("Missing SOL/USD rate");
  if (!xecUsd) throw new Error("Missing XEC/USD rate");

  return { verseUsd, solUsd, xecUsd, usdtNgn, fetchedAt: Date.now() };
}

async function getUnified(): Promise<UnifiedCache> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache;

  if (!inFlight) {
    inFlight = fetchUnified()
      .then((fresh) => {
        cache = fresh;
        inFlight = null;
        return fresh;
      })
      .catch((err) => {
        inFlight = null;
        throw err;
      });
  }

  return inFlight;
}

function makeTokenRate(usdPrice: number, usdtNgn: number): z.infer<typeof TokenRateSchema> {
  const nairaPerToken = usdPrice * usdtNgn;
  const tokenPerNaira = 1 / nairaPerToken;
  const tokenPerNairaWithFee = tokenPerNaira * (1 + FEE_PERCENT / 100);
  return { tokenPerNaira: tokenPerNairaWithFee, nairaPerToken, feePercent: FEE_PERCENT };
}

router.get("/prices/verse-naira", async (req: Request, res: Response): Promise<void> => {
  try {
    const u = await getUnified();
    const nairaPerVerse = u.verseUsd * u.usdtNgn;
    const versePerNaira = 1 / nairaPerVerse;
    const versePerNairaWithFee = versePerNaira * (1 + FEE_PERCENT / 100);
    res.json({
      versePerNaira,
      nairaPerVerse,
      verseUsd: u.verseUsd,
      usdtNgn: u.usdtNgn,
      cachedAt: new Date(u.fetchedAt),
      feePercent: FEE_PERCENT,
      versePerNairaWithFee,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch VERSE/Naira rate");
    if (cache) {
      const u = cache;
      const nairaPerVerse = u.verseUsd * u.usdtNgn;
      const versePerNaira = 1 / nairaPerVerse;
      res.json({
        versePerNaira,
        nairaPerVerse,
        verseUsd: u.verseUsd,
        usdtNgn: u.usdtNgn,
        cachedAt: new Date(u.fetchedAt),
        feePercent: FEE_PERCENT,
        versePerNairaWithFee: versePerNaira * (1 + FEE_PERCENT / 100),
      });
      return;
    }
    res.status(500).json({ error: "Failed to fetch live rate" });
  }
});

router.get("/prices/rates", async (req: Request, res: Response): Promise<void> => {
  try {
    const u = await getUnified();
    res.json({
      verse: makeTokenRate(u.verseUsd, u.usdtNgn),
      usdt: makeTokenRate(1, u.usdtNgn),
      sol: makeTokenRate(u.solUsd, u.usdtNgn),
      ecash: makeTokenRate(u.xecUsd, u.usdtNgn),
      cachedAt: new Date(u.fetchedAt),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch multi-token rates");
    if (cache) {
      const u = cache;
      res.json({
        verse: makeTokenRate(u.verseUsd, u.usdtNgn),
        usdt: makeTokenRate(1, u.usdtNgn),
        sol: makeTokenRate(u.solUsd, u.usdtNgn),
        ecash: makeTokenRate(u.xecUsd, u.usdtNgn),
        cachedAt: new Date(u.fetchedAt),
      });
      return;
    }
    res.status(500).json({ error: "Failed to fetch live rates" });
  }
});

export default router;
