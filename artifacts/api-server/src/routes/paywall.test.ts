import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import supertest from "supertest";
import express, { type Request, type Response, type NextFunction } from "express";

const VALID_BODY = {
  txHash: "0xabc123",
  purchaseType: "airtime",
  phoneNumber: "08012345678",
  nairaAmount: 500,
  verseAmount: "10",
  network: "MTN",
};

// Polygon receipt with a matching ERC-20 Transfer log for VERSE
const VALID_POLYGON_RECEIPT = {
  jsonrpc: "2.0",
  id: 1,
  result: {
    status: "0x1",
    logs: [
      {
        address: "0xc708d6f2153933daa50b2d0758955be0a93a8fec",
        topics: [
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          "0x000000000000000000000000sender000000000000000000000000000000000",
          "0x000000000000000000000000cf882686d0f8ccb72521c7cd3a00cfce63bcdcc7",
        ],
        data: "0x0",
      },
    ],
  },
};

// Receipt that exists but has no matching logs (wrong recipient / contract)
const UNMATCHED_POLYGON_RECEIPT = {
  jsonrpc: "2.0",
  id: 1,
  result: {
    status: "0x1",
    logs: [],
  },
};

function makeFetchMock(rpcResponse: object) {
  return vi.fn(async (url: string | URL | Request) => {
    const urlStr = String(url);
    if (
      urlStr.includes("ankr.com") ||
      urlStr.includes("publicnode.com") ||
      urlStr.includes("drpc.org") ||
      urlStr.includes("mainnet-beta.solana.com") ||
      urlStr.includes("blockchair.com")
    ) {
      return new Response(JSON.stringify(rpcResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Resend / email — let it "fail" silently
    return new Response("{}", { status: 500 });
  });
}

async function buildApp() {
  const { default: paywallRouter } = await import("./paywall.js");
  const app = express();
  app.use(express.json());
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    (_req as unknown as Record<string, unknown>)["log"] = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    };
    next();
  });
  app.use("/api", paywallRouter);
  return app;
}

// Hex-encoded balanceOf result for exactly 2000 VERSE (2000 * 10^18)
// 2000 * 10^18 = 0x6C6B935B8BBD400000  (padded to 32 bytes)
const BALANCE_2000_VERSE_HEX =
  "0x0000000000000000000000000000000000000000000006c6b935b8bbd400000";

describe("GET /api/paywall/verify-verse-balance", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns 400 when walletAddress is missing", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const app = await buildApp();

    const res = await supertest(app).get("/api/paywall/verify-verse-balance");

    expect(res.status).toBe(400);
  });

  it("returns 400 when walletAddress is not a valid EVM address", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const app = await buildApp();

    const res = await supertest(app)
      .get("/api/paywall/verify-verse-balance")
      .query({ walletAddress: "not-an-address" });

    expect(res.status).toBe(400);
  });

  it("returns 500 when every Polygon RPC fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const urlStr = String(url);
        if (
          urlStr.includes("ankr.com") ||
          urlStr.includes("publicnode.com") ||
          urlStr.includes("drpc.org")
        ) {
          throw new Error("Network unreachable");
        }
        return new Response("{}", { status: 500 });
      }),
    );
    const app = await buildApp();

    const res = await supertest(app)
      .get("/api/paywall/verify-verse-balance")
      .query({ walletAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: expect.stringContaining("VERSE balance") });
  });

  it("falls back to second RPC when first fails and returns a valid balance", async () => {
    const balanceResponse = {
      jsonrpc: "2.0",
      id: 1,
      result: BALANCE_2000_VERSE_HEX,
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const urlStr = String(url);
        if (urlStr.includes("ankr.com")) {
          throw new Error("ankr down");
        }
        if (urlStr.includes("publicnode.com") || urlStr.includes("drpc.org")) {
          return new Response(JSON.stringify(balanceResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("{}", { status: 500 });
      }),
    );
    const app = await buildApp();

    const res = await supertest(app)
      .get("/api/paywall/verify-verse-balance")
      .query({ walletAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      eligible: true,
      balance: "2000",
      required: "2000",
    });
  });
});

describe("POST /api/paywall/confirm-purchase", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  // ── 400 — invalid body ──────────────────────────────────────────────────────

  it("returns 400 when required fields are missing", async () => {
    vi.stubGlobal("fetch", makeFetchMock(UNMATCHED_POLYGON_RECEIPT));
    const app = await buildApp();

    const res = await supertest(app)
      .post("/api/paywall/confirm-purchase")
      .send({ txHash: "0xabc" }); // missing purchaseType, phoneNumber, etc.

    expect(res.status).toBe(400);
  });

  // ── 500 — malformed POLYGON_RECIPIENT_ADDRESS ───────────────────────────────

  it("returns 500 for VERSE when POLYGON_RECIPIENT_ADDRESS is malformed", async () => {
    vi.stubEnv("POLYGON_RECIPIENT_ADDRESS", "not-a-valid-eth-address");
    vi.stubGlobal("fetch", makeFetchMock(VALID_POLYGON_RECEIPT));
    const app = await buildApp();

    const res = await supertest(app)
      .post("/api/paywall/confirm-purchase")
      .send({ ...VALID_BODY, paymentToken: "VERSE" });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: expect.stringContaining("configuration error") });
  });

  it("returns 500 for USDT_POLYGON when POLYGON_RECIPIENT_ADDRESS is malformed", async () => {
    vi.stubEnv("POLYGON_RECIPIENT_ADDRESS", "bad");
    vi.stubGlobal("fetch", makeFetchMock(VALID_POLYGON_RECEIPT));
    const app = await buildApp();

    const res = await supertest(app)
      .post("/api/paywall/confirm-purchase")
      .send({ ...VALID_BODY, paymentToken: "USDT_POLYGON" });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: expect.stringContaining("configuration error") });
  });

  it("returns 500 for SOL when SOL_RECIPIENT_ADDRESS is malformed", async () => {
    vi.stubEnv("SOL_RECIPIENT_ADDRESS", "!!!not-base58!!!");
    vi.stubGlobal("fetch", makeFetchMock({}));
    const app = await buildApp();

    const res = await supertest(app)
      .post("/api/paywall/confirm-purchase")
      .send({ ...VALID_BODY, paymentToken: "SOL" });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: expect.stringContaining("configuration error") });
  });

  it("returns 500 for ECASH when XEC_RECIPIENT_ADDRESS is malformed", async () => {
    vi.stubEnv("XEC_RECIPIENT_ADDRESS", "bitcoin:qbadaddress");
    vi.stubGlobal("fetch", makeFetchMock({}));
    const app = await buildApp();

    const res = await supertest(app)
      .post("/api/paywall/confirm-purchase")
      .send({ ...VALID_BODY, paymentToken: "ECASH" });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: expect.stringContaining("configuration error") });
  });

  // ── 402 — on-chain verification returns false ───────────────────────────────

  it("returns 402 when on-chain verification finds no matching transfer log", async () => {
    vi.stubGlobal("fetch", makeFetchMock(UNMATCHED_POLYGON_RECEIPT));
    const app = await buildApp();

    const res = await supertest(app)
      .post("/api/paywall/confirm-purchase")
      .send({ ...VALID_BODY, paymentToken: "VERSE" });

    expect(res.status).toBe(402);
    expect(res.body).toMatchObject({ confirmed: false, txHash: VALID_BODY.txHash });
  });

  it("returns 402 when RPC returns a failed transaction (status 0x0)", async () => {
    const failedReceipt = {
      jsonrpc: "2.0",
      id: 1,
      result: { status: "0x0", logs: [] },
    };
    vi.stubGlobal("fetch", makeFetchMock(failedReceipt));
    const app = await buildApp();

    const res = await supertest(app)
      .post("/api/paywall/confirm-purchase")
      .send({ ...VALID_BODY, paymentToken: "VERSE" });

    expect(res.status).toBe(402);
    expect(res.body).toMatchObject({ confirmed: false });
  });

  it("returns 402 when RPC returns null (tx not found)", async () => {
    const nullReceipt = { jsonrpc: "2.0", id: 1, result: null };
    vi.stubGlobal("fetch", makeFetchMock(nullReceipt));
    const app = await buildApp();

    const res = await supertest(app)
      .post("/api/paywall/confirm-purchase")
      .send({ ...VALID_BODY, paymentToken: "VERSE" });

    expect(res.status).toBe(402);
    expect(res.body).toMatchObject({ confirmed: false });
  });

  // ── 200 — successful verification (mocked RPC) ──────────────────────────────

  it("returns 200 with confirmed:true when VERSE transfer is verified on-chain", async () => {
    vi.stubGlobal("fetch", makeFetchMock(VALID_POLYGON_RECEIPT));
    const app = await buildApp();

    const res = await supertest(app)
      .post("/api/paywall/confirm-purchase")
      .send({ ...VALID_BODY, paymentToken: "VERSE" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      confirmed: true,
      txHash: VALID_BODY.txHash,
      explorerUrl: expect.stringContaining("polygonscan.com"),
    });
  });

  it("returns 200 with confirmed:true when USDT_POLYGON transfer is verified on-chain", async () => {
    const usdtReceipt = {
      ...VALID_POLYGON_RECEIPT,
      result: {
        ...VALID_POLYGON_RECEIPT.result,
        logs: [
          {
            address: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
            topics: [
              "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
              "0x000000000000000000000000sender000000000000000000000000000000000",
              "0x000000000000000000000000cf882686d0f8ccb72521c7cd3a00cfce63bcdcc7",
            ],
            data: "0x0",
          },
        ],
      },
    };
    vi.stubGlobal("fetch", makeFetchMock(usdtReceipt));
    const app = await buildApp();

    const res = await supertest(app)
      .post("/api/paywall/confirm-purchase")
      .send({ ...VALID_BODY, paymentToken: "USDT_POLYGON" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ confirmed: true });
  });
});
