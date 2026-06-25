import { Router, type IRouter, type Request, type Response } from "express";
import nodemailer from "nodemailer";
import { z } from "zod";

const router: IRouter = Router();

const GetPaywallVerifyVerseBalanceResponse = z.object({
  eligible: z.boolean(),
  balance: z.string(),
  required: z.string(),
});

const PostPaywallConfirmPurchaseBody = z.object({
  txHash: z.string(),
  walletAddress: z.string(),
  purchaseType: z.string(),
  phoneNumber: z.string(),
  nairaAmount: z.number(),
  verseAmount: z.string(),
  network: z.string().optional(),
  dataPlan: z.string().optional(),
  txUrl: z.string().optional(),
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
const POLYGON_RPCS = [
  "https://rpc.ankr.com/polygon",
  "https://polygon-bor-rpc.publicnode.com",
  "https://polygon.drpc.org",
];
const VERSE_DECIMALS = 18n;
const REQUIRED_VERSE = 2_000n * 10n ** VERSE_DECIMALS;
const REQUIRED_VERSE_DISPLAY = "2000";
const RECIPIENT_ADDRESS = "0xCF882686d0f8CCB72521C7Cd3A00cfcE63BCDcC7";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL ?? "digdeepeth@gmail.com";
const FROM_EMAIL = process.env.FROM_EMAIL ?? "onboarding@resend.dev";

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

function buildEmailHtml(body: PurchaseEmailBody): string {
  const planRow = body.dataPlan
    ? `<tr><td style="padding:8px;border:1px solid #ddd"><strong>Data Plan</strong></td><td style="padding:8px;border:1px solid #ddd">${body.dataPlan}</td></tr>`
    : "";
  return `<div style="font-family:Arial,sans-serif;max-width:600px">
    <h2 style="color:#136FD3">🔴 New Purchase Alert</h2>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Type</strong></td><td style="padding:8px;border:1px solid #ddd">${body.purchaseType.toUpperCase()}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Network</strong></td><td style="padding:8px;border:1px solid #ddd">${body.network ?? "N/A"}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Phone</strong></td><td style="padding:8px;border:1px solid #ddd">${body.phoneNumber}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Naira</strong></td><td style="padding:8px;border:1px solid #ddd">₦${body.nairaAmount.toLocaleString()}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Verse</strong></td><td style="padding:8px;border:1px solid #ddd">${body.verseAmount} VERSE</td></tr>
      ${planRow}
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Wallet</strong></td><td style="padding:8px;border:1px solid #ddd">${body.walletAddress}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Tx Hash</strong></td><td style="padding:8px;border:1px solid #ddd"><a href="${body.txUrl ?? `https://polygonscan.com/tx/${body.txHash}`}">${body.txHash}</a></td></tr>
    </table></div>`;
}

async function sendPurchaseEmail(body: PurchaseEmailBody, log?: import("pino").Logger): Promise<{ sent: boolean; error?: string }> {
  const subject = `New ${body.purchaseType === "airtime" ? "Airtime" : "Data"} Purchase — ${body.phoneNumber}`;
  const html = buildEmailHtml(body);
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
  const explorerUrl = body.txUrl ?? `https://polygonscan.com/tx/${body.txHash}`;
  let confirmed = false;

  try {
    const receipt = await fetchTransactionReceipt(body.txHash);
    if (receipt) {
      const r = receipt as { status?: string; logs?: Array<{ topics?: string[]; data?: string }> };
      if (r.status === "0x1") {
        confirmed = (r.logs ?? []).some((log) => {
          const topics = log.topics ?? [];
          return topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
            && topics[2]?.toLowerCase() === "0x000000000000000000000000" + RECIPIENT_ADDRESS.toLowerCase().slice(2);
        });
      }
    }
  } catch (err) {
    req.log.error({ err, txHash: body.txHash }, "Failed to fetch transaction receipt");
  }

  const emailResult = await sendPurchaseEmail(body, req.log);
  res.json(PostPaywallConfirmPurchaseResponse.parse({
    confirmed,
    txHash: body.txHash,
    explorerUrl,
    emailSent: emailResult.sent,
    emailError: emailResult.error,
  }));
});

export default router;
