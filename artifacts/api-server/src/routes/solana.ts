import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const SOL_RPCS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana.publicnode.com",
  "https://rpc.ankr.com/solana",
  "https://solana.drpc.org",
];

async function solanaRpc(method: string, params: unknown[] = []): Promise<unknown> {
  let lastErr: unknown;
  for (const rpc of SOL_RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) { lastErr = new Error(`HTTP ${res.status} from ${rpc}`); continue; }
      const json = (await res.json()) as { result?: unknown; error?: { message?: string } };
      if (json.error) { lastErr = new Error(json.error.message ?? "RPC error"); continue; }
      return json.result;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("All Solana RPC endpoints failed");
}

router.get("/solana/blockhash", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = (await solanaRpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as {
      value: { blockhash: string; lastValidBlockHeight: number };
    };
    res.json({ blockhash: result.value.blockhash, lastValidBlockHeight: result.value.lastValidBlockHeight });
  } catch (err) {
    req.log.error({ err }, "Failed to get Solana blockhash");
    res.status(502).json({ error: "Could not fetch Solana blockhash. Please try again." });
  }
});

router.post("/solana/send-transaction", async (req: Request, res: Response): Promise<void> => {
  const { transaction } = req.body as { transaction?: string };
  if (!transaction || typeof transaction !== "string") {
    res.status(400).json({ error: "Missing transaction field (base64-encoded signed transaction)" });
    return;
  }
  try {
    const signature = await solanaRpc("sendTransaction", [transaction, { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed" }]);
    res.json({ signature });
  } catch (err) {
    req.log.error({ err }, "Failed to send Solana transaction");
    res.status(502).json({ error: "Could not submit transaction. Please try again." });
  }
});

router.get("/solana/confirm/:signature", async (req: Request, res: Response): Promise<void> => {
  const { signature } = req.params;
  if (!signature) { res.status(400).json({ error: "Missing signature" }); return; }
  try {
    const result = (await solanaRpc("getSignatureStatuses", [[signature], { searchTransactionHistory: true }])) as {
      value: Array<{ confirmationStatus?: string; err?: unknown } | null>;
    };
    const status = result.value[0];
    if (!status) { res.json({ status: "pending" }); return; }
    if (status.err) { res.json({ status: "failed", error: JSON.stringify(status.err) }); return; }
    const conf = status.confirmationStatus;
    if (conf === "confirmed" || conf === "finalized") {
      res.json({ status: "confirmed" });
    } else {
      res.json({ status: "pending" });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to confirm Solana transaction");
    res.status(502).json({ error: "Could not check transaction status." });
  }
});

export default router;
