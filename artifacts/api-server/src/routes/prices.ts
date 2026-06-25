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

const VERSE_CONTRACT = "0xc708d6f2153933daa50b2d0758955be0a93a8fec";
const VERSE_COIN_ID = "verse-bitcoin";
const CACHE_TTL_MS = 60_000;

interface RateCache {
  data: z.infer<typeof GetVerseNairaRateResponse>;
  fetchedAt: number;
}

let rateCache: RateCache | null = null;

async function fetchVerseUsd(): Promise<number> {
  const contractRes = await fetch(
    `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${VERSE_CONTRACT}&vs_currencies=usd`,
  );
  if (!contractRes.ok) throw new Error(`CoinGecko token_price fetch failed: HTTP ${contractRes.status}`);
  const contractData = (await contractRes.json()) as Record<string, Record<string, number>>;
  const fromContract = contractData[VERSE_CONTRACT]?.usd ?? contractData[VERSE_CONTRACT.toLowerCase()]?.usd;
  if (fromContract) return fromContract;

  const coinRes = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${VERSE_COIN_ID}&vs_currencies=usd`,
  );
  if (!coinRes.ok) throw new Error(`CoinGecko simple/price fallback failed: HTTP ${coinRes.status}`);
  const coinData = (await coinRes.json()) as Record<string, Record<string, number>>;
  const fromCoin = coinData[VERSE_COIN_ID]?.usd;
  if (!fromCoin) throw new Error(`No VERSE/USD price available`);
  return fromCoin;
}

async function fetchLiveRate(): Promise<z.infer<typeof GetVerseNairaRateResponse>> {
  const [verseUsd, usdtNgn] = await Promise.all([
    fetchVerseUsd(),
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=ngn")
      .then(async (res) => {
        if (!res.ok) throw new Error(`CoinGecko USDT/NGN fetch failed: HTTP ${res.status}`);
        const data = (await res.json()) as { tether?: { ngn?: number } };
        const ngn = data?.tether?.ngn;
        if (!ngn) throw new Error(`Unexpected USDT/NGN response`);
        return ngn;
      }),
  ]);

  const nairaPerVerse = verseUsd * usdtNgn;
  const versePerNaira = 1 / nairaPerVerse;
  const FEE_PERCENT = 2;
  const versePerNairaWithFee = versePerNaira * (1 + FEE_PERCENT / 100);

  return { versePerNaira, nairaPerVerse, verseUsd, usdtNgn, cachedAt: new Date(), feePercent: FEE_PERCENT, versePerNairaWithFee };
}

router.get("/prices/verse-naira", async (req: Request, res: Response): Promise<void> => {
  const now = Date.now();
  if (rateCache && now - rateCache.fetchedAt < CACHE_TTL_MS) {
    res.json(rateCache.data);
    return;
  }
  try {
    const fresh = await fetchLiveRate();
    rateCache = { data: fresh, fetchedAt: now };
    res.json(fresh);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch VERSE/Naira rate");
    if (rateCache) { res.json(rateCache.data); return; }
    res.status(500).json({ error: "Failed to fetch live rate" });
  }
});

export default router;
