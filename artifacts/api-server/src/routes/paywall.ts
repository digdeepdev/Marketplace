import { Router, type IRouter, type Request, type Response } from "express";
import nodemailer from "nodemailer";
import { z } from "zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const GetPaywallVerifyVerseBalanceResponse = z.object({
  eligible: z.boolean(),
  balance: z.string(),
  required: z.string(),
});

const PaymentTokenSchema = z.enum(["VERSE", "USDT_POLYGON", "SOL", "ECASH", "USDT_BSC", "USDT_SOL"]);
export type PaymentToken = z.infer<typeof PaymentTokenSchema>;

const PostPaywallConfirmPurchaseBody = z.object({
  txHash: z.string(),
  walletAddress: z.string().optional(),
  purchaseType: z.string(),
  phoneNumber: z.string(),
  nairaAmount: z.number(),
  verseAmount: z.string(),
  network: z.string().optional(),
  dataPlan: z.string().optional(),
  txUrl: z.string().optional(),
  paymentToken: PaymentTokenSchema.optional().default("VERSE"),
});

const PostPaywallConfirmPurchaseResponse = z.object({
  confirmed: z.boolean(),
  txHash: z.string(),
  explorerUrl: z.string(),
  emailSent: z.boolean(),
  emailError: z.string().optional(),
});

type PurchaseEmailBody = z.infer<typeof PostPaywallConfirmPurchaseBody>;

const VERSE_CONTRACT_POLYGON = "0xc708d6f2153933daa50b2d0758955be0a93a8fec";
const USDT_CONTRACT_POLYGON = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
const BSC_USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955";
const SOL_USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const POLYGON_RPCS = [
  "https://rpc.ankr.com/polygon",
  "https://polygon-bor-rpc.publicnode.com",
  "https://polygon.drpc.org",
];
const BSC_RPCS = [
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.defibit.io",
  "https://bsc.publicnode.com",
];
const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const VERSE_DECIMALS = 18n;
const REQUIRED_VERSE = 2_000n * 10n ** VERSE_DECIMALS;
const REQUIRED_VERSE_DISPLAY = "2000";
const RECIPIENT_ADDRESS = process.env.POLYGON_RECIPIENT_ADDRESS ?? "0xCF882686d0f8CCB72521C7Cd3A00cfcE63BCDcC7";
const BSC_RECIPIENT_ADDRESS = process.env.BSC_RECIPIENT_ADDRESS ?? "0x04D8ed7057Ab80c26EBF29609d3Ea65cdbe8E068";

const SOL_RECIPIENT_ADDRESS = process.env.SOL_RECIPIENT_ADDRESS ?? "GrM8dS4hk8h92UPNqfdhZn4CG1TgYUQJYBXcj7AfaQmS";
const XEC_RECIPIENT_ADDRESS = process.env.XEC_RECIPIENT_ADDRESS ?? "ecash:qr6w9rxspfvnay2mtm3sxdxgls6fnvcf8sqzlcqly6";

// ── Startup address validation ────────────────────────────────────────────────
// EIP-55 Ethereum/Polygon address: 0x + 40 hex chars
const POLYGON_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
// Base58 alphabet (Bitcoin/Solana): no 0, O, I, l — 32–44 characters
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
// eCash cashaddr: "ecash:" prefix + 40–55 lowercase base32 chars
const ECASH_ADDRESS_RE = /^ecash:[a-z0-9]{40,55}$/;

if (!POLYGON_ADDRESS_RE.test(RECIPIENT_ADDRESS)) {
  logger.error(
    { RECIPIENT_ADDRESS },
    "STARTUP ERROR: POLYGON_RECIPIENT_ADDRESS does not look like a valid EIP-55 Polygon address (expected 0x + 40 hex chars) — payments would be misrouted. Set POLYGON_RECIPIENT_ADDRESS correctly and restart."
  );
}
if (!POLYGON_ADDRESS_RE.test(BSC_RECIPIENT_ADDRESS)) {
  logger.error(
    { BSC_RECIPIENT_ADDRESS },
    "STARTUP ERROR: BSC_RECIPIENT_ADDRESS does not look like a valid EIP-55 BSC address (expected 0x + 40 hex chars) — payments would be misrouted. Set BSC_RECIPIENT_ADDRESS correctly and restart."
  );
}
if (!SOLANA_ADDRESS_RE.test(SOL_RECIPIENT_ADDRESS)) {
  logger.error(
    { SOL_RECIPIENT_ADDRESS },
    "STARTUP ERROR: SOL_RECIPIENT_ADDRESS does not look like a valid Solana base58 address — payments would be misrouted. Set SOL_RECIPIENT_ADDRESS correctly and restart."
  );
}
if (!ECASH_ADDRESS_RE.test(XEC_RECIPIENT_ADDRESS)) {
  logger.error(
    { XEC_RECIPIENT_ADDRESS },
    "STARTUP ERROR: XEC_RECIPIENT_ADDRESS does not look like a valid eCash cashaddr address (expected ecash:<40-55 base32 chars>) — payments would be misrouted. Set XEC_RECIPIENT_ADDRESS correctly and restart."
  );
}

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL ?? "digdeepeth@gmail.com";
const FROM_EMAIL = process.env.FROM_EMAIL ?? "onboarding@resend.dev";

const TOKEN_LABELS: Record<PaymentToken, string> = {
  VERSE: "VERSE (Polygon)",
  USDT_POLYGON: "USDT (Polygon)",
  SOL: "SOL (Solana)",
  ECASH: "eCash (XEC)",
  USDT_BSC: "USDT (BEP20 / BSC)",
  USDT_SOL: "USDT (Solana SPL)",
};

function explorerUrlForToken(txHash: string, paymentToken: PaymentToken): string {
  switch (paymentToken) {
    case "VERSE":
    case "USDT_POLYGON":
      return `https://polygonscan.com/tx/${txHash}`;
    case "SOL":
    case "USDT_SOL":
      return `https://solscan.io/tx/${txHash}`;
    case "ECASH":
      return `https://blockchair.com/ecash/transaction/${txHash}`;
    case "USDT_BSC":
      return `https://bscscan.com/tx/${txHash}`;
  }
}

function makeTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: { rejectUnauthorized: false },
  });
}

async function sendViaResend(subject: string, html: string): Promise<{ sent: boolean; error?: string }> {
  try {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) return { sent: false, error: "RESEND_API_KEY not set" };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `Marketplace Alerts <${FROM_EMAIL}>`,
        to: NOTIFICATION_EMAIL,
        subject,
        html,
      }),
    });
    if (!res.ok) return { sent: false, error: `Resend error: ${res.status}` };
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function buildEmailHtml(body: PurchaseEmailBody, explorerUrl: string): string {
  const planRow = body.dataPlan
    ? `<tr><td style="padding:8px;border:1px solid #ddd"><strong>Data Plan</strong></td><td style="padding:8px;border:1px solid #ddd">${body.dataPlan}</td></tr>`
    : "";
  const token = body.paymentToken ?? "VERSE";
  const tokenLabel = TOKEN_LABELS[token] ?? token;
  const walletRow = body.walletAddress
    ? `<tr><td style="padding:8px;border:1px solid #ddd"><strong>Wallet</strong></td><td style="padding:8px;border:1px solid #ddd">${body.walletAddress}</td></tr>`
    : "";
  return `<div style="font-family:Arial,sans-serif;max-width:600px">
    <h2 style="color:#136FD3">🔴 New Purchase Alert</h2>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Payment Token</strong></td><td style="padding:8px;border:1px solid #ddd">${tokenLabel}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Type</strong></td><td style="padding:8px;border:1px solid #ddd">${body.purchaseType.toUpperCase()}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Network</strong></td><td style="padding:8px;border:1px solid #ddd">${body.network ?? "N/A"}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Phone</strong></td><td style="padding:8px;border:1px solid #ddd">${body.phoneNumber}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Naira</strong></td><td style="padding:8px;border:1px solid #ddd">₦${body.nairaAmount.toLocaleString()}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Amount</strong></td><td style="padding:8px;border:1px solid #ddd">${body.verseAmount} ${tokenLabel}</td></tr>
      ${planRow}
      ${walletRow}
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Tx Hash</strong></td><td style="padding:8px;border:1px solid #ddd"><a href="${explorerUrl}">${body.txHash}</a></td></tr>
    </table></div>`;
}

async function sendPurchaseEmail(body: PurchaseEmailBody, explorerUrl: string, log?: import("pino").Logger): Promise<{ sent: boolean; error?: string }> {
  const subject = `New ${body.purchaseType === "airtime" ? "Airtime" : "Data"} Purchase — ${body.phoneNumber}`;
  const html = buildEmailHtml(body, explorerUrl);
  const transporter = makeTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({ from: `"Marketplace Alerts" <${SMTP_USER}>`, to: NOTIFICATION_EMAIL, subject, html });
      return { sent: true };
    } catch (err) {
      log?.warn({ error: err }, "SMTP failed; falling back to Resend");
    }
  }
  return sendViaResend(subject, html);
}

function encodeBalanceOf(address: string): string {
  return "0x70a08231" + address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

async function jsonRpcCall(rpcUrl: string, method: string, params: unknown) {
  const res = await fetch(rpcUrl, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  return (await res.json()) as { result?: unknown; error?: { message: string } };
}

async function fetchVerseBalance(walletAddress: string): Promise<bigint> {
  let lastError: Error | undefined;
  for (const rpc of POLYGON_RPCS) {
    try {
      const json = await jsonRpcCall(rpc, "eth_call", [{ to: VERSE_CONTRACT_POLYGON, data: encodeBalanceOf(walletAddress) }, "latest"]);
      // Skip RPCs that return a JSON-RPC error (e.g. Ankr auth required) and try next
      if (json.error) { logger.warn({ rpc, error: json.error }, "RPC returned JSON-RPC error, trying next"); continue; }
      const hex = (json.result as string) ?? "0x0";
      return BigInt(hex === "0x" ? "0x0" : hex);
    } catch (err) { lastError = err instanceof Error ? err : new Error(String(err)); }
  }
  throw lastError ?? new Error("All Polygon RPCs failed");
}

async function fetchTransactionReceipt(txHash: string): Promise<unknown | null> {
  for (const rpc of POLYGON_RPCS) {
    try {
      const json = await jsonRpcCall(rpc, "eth_getTransactionReceipt", [txHash]);
      // If the RPC returned a JSON-RPC error (e.g. Ankr 401 wrapped in HTTP 200), try next
      if (json.error) { logger.warn({ rpc, error: json.error }, "RPC returned JSON-RPC error, trying next"); continue; }
      return json.result ?? null;
    } catch { continue; }
  }
  return null;
}

function formatUnits(value: bigint, decimals: bigint): string {
  const divisor = 10n ** decimals;
  const intPart = value / divisor;
  const fracPart = value % divisor;
  if (fracPart === 0n) return intPart.toString();
  return `${intPart}.${fracPart.toString().padStart(Number(decimals), "0").replace(/0+$/, "")}`;
}

async function verifyPolygonErc20Tx(txHash: string, tokenContract: string, log?: import("pino").Logger): Promise<boolean> {
  const receipt = await fetchTransactionReceipt(txHash);
  if (!receipt) {
    log?.warn({ txHash }, "verifyPolygonErc20Tx: receipt is null — tx not found or all RPCs failed");
    return false;
  }
  const r = receipt as { status?: string; logs?: Array<{ address?: string; topics?: string[]; data?: string }> };
  if (r.status !== "0x1") {
    log?.warn({ txHash, status: r.status }, "verifyPolygonErc20Tx: tx status is not 0x1 (reverted or pending)");
    return false;
  }
  const expectedRecipient = "0x000000000000000000000000" + RECIPIENT_ADDRESS.toLowerCase().slice(2);
  const TRANSFER_SIG = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const matched = (r.logs ?? []).some((entry) => {
    const topics = entry.topics ?? [];
    const matchTransfer = topics[0] === TRANSFER_SIG;
    const matchRecipient = topics[2]?.toLowerCase() === expectedRecipient;
    const matchContract = entry.address?.toLowerCase() === tokenContract.toLowerCase();
    return matchTransfer && matchRecipient && matchContract;
  });
  if (!matched) {
    const relevantLogs = (r.logs ?? []).map((entry) => ({
      address: entry.address,
      topic0: entry.topics?.[0],
      topic2: entry.topics?.[2],
      matchContract: entry.address?.toLowerCase() === tokenContract.toLowerCase(),
      matchTransfer: entry.topics?.[0] === TRANSFER_SIG,
      matchRecipient: entry.topics?.[2]?.toLowerCase() === expectedRecipient,
    }));
    log?.warn({ txHash, tokenContract, expectedRecipient, relevantLogs },
      "verifyPolygonErc20Tx: no matching Transfer log found");
  }
  return matched;
}

async function verifySolanaTx(txSignature: string): Promise<boolean> {
  try {
    const res = await fetch(SOLANA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "getTransaction",
        params: [txSignature, { encoding: "json", maxSupportedTransactionVersion: 0 }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      result?: {
        meta?: {
          err?: unknown;
          preBalances?: number[];
          postBalances?: number[];
        };
        transaction?: {
          message?: {
            accountKeys?: string[];
          };
        };
      } | null;
    };
    if (!data.result) return false;

    const meta = data.result.meta;
    const message = data.result.transaction?.message;

    // Tx must have succeeded (no error)
    if (meta?.err != null) return false;

    // Validate the recipient address received SOL
    const accountKeys = message?.accountKeys ?? [];
    const recipientIndex = accountKeys.findIndex((k) => k === SOL_RECIPIENT_ADDRESS);
    if (recipientIndex === -1) return false;

    const pre = meta?.preBalances?.[recipientIndex] ?? 0;
    const post = meta?.postBalances?.[recipientIndex] ?? 0;
    // Recipient must have a positive balance increase
    return post > pre;
  } catch {
    return false;
  }
}

// Fields that verifyEcashTx depends on are required so that any Blockchair
// rename (e.g. block_id → blockId, recipient → address) fails validation and
// surfaces a structured warning instead of silently returning false.
const BlockchairTxEntrySchema = z.object({
  transaction: z.object({ block_id: z.number() }),
  outputs: z.array(
    z.object({
      recipient: z.string(),
      value: z.number(),
      is_spent: z.boolean().optional(),
    })
  ),
});

// data is optional at the top level — Blockchair may omit it for unknown txids
// (non-OK HTTP is already rejected before we parse).
const BlockchairResponseSchema = z.object({
  data: z.record(z.string(), BlockchairTxEntrySchema).optional(),
});

// Parse a human-readable decimal amount string (e.g. "5.23") to a raw bigint
// with the given number of decimal places (e.g. 18 for VERSE, 6 for USDT SPL).
function parseRawAmount(amountStr: string, decimals: bigint): bigint {
  const [intPart = "0", fracPart = ""] = amountStr.split(".");
  const fracPadded = fracPart.padEnd(Number(decimals), "0").slice(0, Number(decimals));
  return BigInt(intPart) * (10n ** decimals) + BigInt(fracPadded || "0");
}

async function fetchBscTransactionReceipt(txHash: string): Promise<unknown | null> {
  for (const rpc of BSC_RPCS) {
    try {
      const json = await jsonRpcCall(rpc, "eth_getTransactionReceipt", [txHash]);
      if (json.error) { logger.warn({ rpc, error: json.error }, "BSC RPC returned JSON-RPC error, trying next"); continue; }
      return json.result ?? null;
    } catch { continue; }
  }
  return null;
}

async function verifyBscUsdtTx(txHash: string, expectedRawAmount: bigint, log?: import("pino").Logger): Promise<boolean> {
  const receipt = await fetchBscTransactionReceipt(txHash);
  if (!receipt) {
    log?.warn({ txHash }, "verifyBscUsdtTx: receipt is null — tx not found or all BSC RPCs failed");
    return false;
  }
  const r = receipt as { status?: string; logs?: Array<{ address?: string; topics?: string[]; data?: string }> };
  if (r.status !== "0x1") {
    log?.warn({ txHash, status: r.status }, "verifyBscUsdtTx: tx status is not 0x1 (reverted or pending)");
    return false;
  }
  const expectedRecipient = "0x000000000000000000000000" + BSC_RECIPIENT_ADDRESS.toLowerCase().slice(2);
  const TRANSFER_SIG = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const matched = (r.logs ?? []).some((entry) => {
    const topics = entry.topics ?? [];
    const matchTransfer = topics[0] === TRANSFER_SIG;
    const matchRecipient = topics[2]?.toLowerCase() === expectedRecipient;
    const matchContract = entry.address?.toLowerCase() === BSC_USDT_CONTRACT.toLowerCase();
    if (!matchTransfer || !matchRecipient || !matchContract) return false;
    // Decode Transfer amount from log data (uint256, 32 bytes big-endian hex)
    const rawHex = entry.data ?? "0x0";
    const rawAmount = BigInt(rawHex === "0x" ? "0x0" : rawHex);
    const amountOk = rawAmount >= expectedRawAmount;
    if (!amountOk) {
      log?.warn({ txHash, rawAmount: rawAmount.toString(), expectedRawAmount: expectedRawAmount.toString() },
        "verifyBscUsdtTx: Transfer amount is less than expected");
    }
    return amountOk;
  });
  if (!matched) {
    const relevantLogs = (r.logs ?? []).map((entry) => ({
      address: entry.address,
      topic0: entry.topics?.[0],
      topic2: entry.topics?.[2],
      matchContract: entry.address?.toLowerCase() === BSC_USDT_CONTRACT.toLowerCase(),
      matchTransfer: entry.topics?.[0] === TRANSFER_SIG,
      matchRecipient: entry.topics?.[2]?.toLowerCase() === expectedRecipient,
    }));
    log?.warn({ txHash, expectedRecipient, expectedRawAmount: expectedRawAmount.toString(), relevantLogs },
      "verifyBscUsdtTx: no matching Transfer log with sufficient amount found");
  }
  return matched;
}

async function verifySolanaUsdtTx(txSignature: string, expectedRawAmount: bigint, log?: import("pino").Logger): Promise<boolean> {
  try {
    const res = await fetch(SOLANA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "getTransaction",
        params: [txSignature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      result?: {
        meta?: {
          err?: unknown;
          preTokenBalances?: Array<{ mint?: string; owner?: string; uiTokenAmount?: { amount?: string; uiAmount?: number | null } }>;
          postTokenBalances?: Array<{ mint?: string; owner?: string; uiTokenAmount?: { amount?: string; uiAmount?: number | null } }>;
        };
      } | null;
    };
    if (!data.result) return false;
    if (data.result.meta?.err != null) return false;

    const preBalances = data.result.meta?.preTokenBalances ?? [];
    const postBalances = data.result.meta?.postTokenBalances ?? [];

    // Find the recipient's USDT entry in postTokenBalances
    const postEntry = postBalances.find(
      (b) => b.mint === SOL_USDT_MINT && b.owner === SOL_RECIPIENT_ADDRESS
    );
    if (!postEntry) {
      log?.warn({ txSignature, SOL_RECIPIENT_ADDRESS, SOL_USDT_MINT },
        "verifySolanaUsdtTx: recipient USDT entry not found in postTokenBalances");
      return false;
    }
    // Use integer string amount (not float uiAmount) to avoid precision loss
    const postRaw = BigInt(postEntry.uiTokenAmount?.amount ?? "0");

    // Find corresponding preBalance entry
    const preEntry = preBalances.find(
      (b) => b.mint === SOL_USDT_MINT && b.owner === SOL_RECIPIENT_ADDRESS
    );
    const preRaw = BigInt(preEntry?.uiTokenAmount?.amount ?? "0");

    const delta = postRaw > preRaw ? postRaw - preRaw : 0n;
    const amountOk = delta >= expectedRawAmount;
    if (!amountOk) {
      log?.warn({ txSignature, delta: delta.toString(), expectedRawAmount: expectedRawAmount.toString() },
        "verifySolanaUsdtTx: received USDT amount is less than expected");
    }
    return amountOk;
  } catch (err) {
    log?.warn({ err, txSignature }, "verifySolanaUsdtTx: exception during verification");
    return false;
  }
}

async function verifyEcashTx(txid: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.blockchair.com/ecash/dashboards/transaction/${txid}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return false;

    const raw: unknown = await res.json();
    const parsed = BlockchairResponseSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn({ txid, rawResponse: raw, zodError: parsed.error.flatten() },
        "Blockchair response shape mismatch — schema validation failed");
      return false;
    }

    const data = parsed.data;
    if (!data.data) return false;
    const txEntry = data.data[txid];
    if (!txEntry) return false;

    // Must be confirmed (included in a block)
    if (!txEntry.transaction?.block_id || txEntry.transaction.block_id < 0) return false;

    // Validate at least one output goes to our XEC recipient with positive value
    const outputs = txEntry.outputs ?? [];
    return outputs.some((o) => o.recipient === XEC_RECIPIENT_ADDRESS && (o.value ?? 0) > 0);
  } catch {
    return false;
  }
}

router.get("/paywall/verify-verse-balance", async (req: Request, res: Response): Promise<void> => {
  const walletAddress = req.query["walletAddress"];
  if (typeof walletAddress !== "string" || !walletAddress) {
    res.status(400).json({ error: "walletAddress query param is required" }); return;
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    res.status(400).json({ error: "Invalid EVM wallet address" }); return;
  }
  try {
    const rawBalance = await fetchVerseBalance(walletAddress);
    res.json(GetPaywallVerifyVerseBalanceResponse.parse({
      eligible: rawBalance >= REQUIRED_VERSE,
      balance: formatUnits(rawBalance, VERSE_DECIMALS),
      required: REQUIRED_VERSE_DISPLAY,
    }));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch VERSE balance");
    res.status(500).json({ error: "Failed to fetch VERSE balance" });
  }
});

router.post("/paywall/confirm-purchase", async (req: Request, res: Response): Promise<void> => {
  const parsed = PostPaywallConfirmPurchaseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const body = parsed.data;
  const paymentToken = body.paymentToken ?? "VERSE";
  const explorerUrl = body.txUrl ?? explorerUrlForToken(body.txHash, paymentToken);

  // ── Runtime recipient address guard ──────────────────────────────────────────
  // Reject the purchase before any money moves if the configured recipient
  // address is malformed (e.g. an operator set a bad env var after startup).
  switch (paymentToken) {
    case "VERSE":
    case "USDT_POLYGON":
      if (!POLYGON_ADDRESS_RE.test(RECIPIENT_ADDRESS)) {
        req.log.error({ RECIPIENT_ADDRESS }, "confirm-purchase blocked: POLYGON_RECIPIENT_ADDRESS is not a valid EIP-55 address");
        res.status(500).json({ error: "Service configuration error: the recipient address is invalid. Please contact support." });
        return;
      }
      break;
    case "USDT_BSC":
      if (!POLYGON_ADDRESS_RE.test(BSC_RECIPIENT_ADDRESS)) {
        req.log.error({ BSC_RECIPIENT_ADDRESS }, "confirm-purchase blocked: BSC_RECIPIENT_ADDRESS is not a valid EIP-55 address");
        res.status(500).json({ error: "Service configuration error: the recipient address is invalid. Please contact support." });
        return;
      }
      break;
    case "SOL":
    case "USDT_SOL":
      if (!SOLANA_ADDRESS_RE.test(SOL_RECIPIENT_ADDRESS)) {
        req.log.error({ SOL_RECIPIENT_ADDRESS }, "confirm-purchase blocked: SOL_RECIPIENT_ADDRESS is not a valid Solana base58 address");
        res.status(500).json({ error: "Service configuration error: the recipient address is invalid. Please contact support." });
        return;
      }
      break;
    case "ECASH":
      if (!ECASH_ADDRESS_RE.test(XEC_RECIPIENT_ADDRESS)) {
        req.log.error({ XEC_RECIPIENT_ADDRESS }, "confirm-purchase blocked: XEC_RECIPIENT_ADDRESS is not a valid eCash cashaddr address");
        res.status(500).json({ error: "Service configuration error: the recipient address is invalid. Please contact support." });
        return;
      }
      break;
  }
  let confirmed = false;
  let verifyError: string | undefined;

  try {
    switch (paymentToken) {
      case "VERSE":
        confirmed = await verifyPolygonErc20Tx(body.txHash, VERSE_CONTRACT_POLYGON, req.log);
        break;
      case "USDT_POLYGON":
        confirmed = await verifyPolygonErc20Tx(body.txHash, USDT_CONTRACT_POLYGON, req.log);
        break;
      case "USDT_BSC": {
        // BSC USDT has 18 decimals (unlike USDT on Ethereum/Polygon which uses 6)
        const expectedRaw = parseRawAmount(body.verseAmount, 18n);
        confirmed = await verifyBscUsdtTx(body.txHash, expectedRaw, req.log);
        break;
      }
      case "SOL":
        confirmed = await verifySolanaTx(body.txHash);
        break;
      case "USDT_SOL": {
        // Solana SPL USDT has 6 decimals
        const expectedRaw = parseRawAmount(body.verseAmount, 6n);
        confirmed = await verifySolanaUsdtTx(body.txHash, expectedRaw, req.log);
        break;
      }
      case "ECASH":
        confirmed = await verifyEcashTx(body.txHash);
        break;
    }
  } catch (err) {
    req.log.error({ err, txHash: body.txHash, paymentToken }, "Failed to verify transaction");
    verifyError = err instanceof Error ? err.message : String(err);
  }

  if (!confirmed) {
    req.log.warn({ txHash: body.txHash, paymentToken, verifyError }, "Purchase not confirmed — skipping fulfillment");
    res.status(402).json({
      confirmed: false,
      txHash: body.txHash,
      explorerUrl,
      emailSent: false,
      error: verifyError
        ? "Transaction verification failed; please try again later."
        : "Transaction could not be verified on-chain. Check that you sent to the correct address and the transaction is confirmed.",
    });
    return;
  }

  const emailResult = await sendPurchaseEmail(body, explorerUrl, req.log);
  res.json(PostPaywallConfirmPurchaseResponse.parse({
    confirmed: true,
    txHash: body.txHash,
    explorerUrl,
    emailSent: emailResult.sent,
    emailError: emailResult.error,
  }));
});

export default router;
