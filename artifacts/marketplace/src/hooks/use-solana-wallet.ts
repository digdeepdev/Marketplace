import { useState, useEffect, useCallback } from "react";

interface PhantomProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isConnected: boolean;
  publicKey: { toString(): string } | null;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  signTransaction(tx: unknown): Promise<unknown>;
}

function getProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    phantom?: { solana?: PhantomProvider };
    solana?: PhantomProvider;
    solflare?: PhantomProvider;
  };
  if (w.phantom?.solana?.isPhantom) return w.phantom.solana;
  if (w.solana?.isPhantom) return w.solana;
  if (w.solflare?.isSolflare) return w.solflare;
  return null;
}

async function getBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  const res = await fetch("/api/solana/blockhash");
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Failed to get Solana blockhash");
  }
  return res.json() as Promise<{ blockhash: string; lastValidBlockHeight: number }>;
}

async function sendTransaction(serializedBase64: string): Promise<string> {
  const res = await fetch("/api/solana/send-transaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: serializedBase64 }),
  });
  const body = (await res.json()) as { signature?: string; error?: string };
  if (!res.ok || !body.signature) throw new Error(body.error ?? "Failed to submit Solana transaction");
  return body.signature as string;
}

export interface SolanaWalletState {
  hasProvider: boolean;
  isConnected: boolean;
  publicKey: string | null;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendSol: (recipient: string, amountSol: number) => Promise<string>;
  sendSplToken: (mintAddress: string, recipient: string, amount: number, decimals: number) => Promise<string>;
  confirmTx: (sig: string, timeoutMs?: number) => Promise<void>;
}

export function useSolanaWallet(): SolanaWalletState {
  const [hasProvider, setHasProvider] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const provider = getProvider();
    if (provider) {
      setHasProvider(true);
      if (provider.isConnected && provider.publicKey) {
        setIsConnected(true);
        setPublicKey(provider.publicKey.toString());
      }
    }
  }, []);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      window.open("https://phantom.app/", "_blank");
      return;
    }
    setIsConnecting(true);
    try {
      const resp = await provider.connect();
      setPublicKey(resp.publicKey.toString());
      setIsConnected(true);
    } catch {
      // user rejected
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const provider = getProvider();
    if (provider) {
      await provider.disconnect().catch(() => {});
    }
    setIsConnected(false);
    setPublicKey(null);
  }, []);

  const sendSol = useCallback(async (recipient: string, amountSol: number): Promise<string> => {
    const { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
    const provider = getProvider();
    if (!provider || !publicKey) throw new Error("Solana wallet not connected");

    const { blockhash } = await getBlockhash();
    const fromPubkey = new PublicKey(publicKey);
    const toPubkey = new PublicKey(recipient);
    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);

    const tx = new Transaction();
    tx.add(SystemProgram.transfer({ fromPubkey, toPubkey, lamports: BigInt(lamports) }));
    tx.recentBlockhash = blockhash;
    tx.feePayer = fromPubkey;

    const signed = await provider.signTransaction(tx);
    const raw = (signed as { serialize(): Uint8Array }).serialize();
    const base64 = btoa(String.fromCharCode(...raw));
    return sendTransaction(base64);
  }, [publicKey]);

  const sendSplToken = useCallback(async (
    mintAddress: string,
    recipient: string,
    amount: number,
    decimals: number,
  ): Promise<string> => {
    const { PublicKey, Transaction } = await import("@solana/web3.js");
    const {
      getAssociatedTokenAddress,
      createTransferInstruction,
      createAssociatedTokenAccountIdempotentInstruction,
    } = await import("@solana/spl-token");

    const provider = getProvider();
    if (!provider || !publicKey) throw new Error("Solana wallet not connected");

    const { blockhash } = await getBlockhash();
    const fromPubkey = new PublicKey(publicKey);
    const mintPubkey = new PublicKey(mintAddress);
    const toPubkey = new PublicKey(recipient);

    const fromAta = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
    const toAta = await getAssociatedTokenAddress(mintPubkey, toPubkey);

    const rawAmount = BigInt(Math.round(amount * 10 ** decimals));

    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = fromPubkey;

    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        fromPubkey,
        toAta,
        toPubkey,
        mintPubkey,
      ),
    );
    tx.add(
      createTransferInstruction(fromAta, toAta, fromPubkey, rawAmount),
    );

    const signed = await provider.signTransaction(tx);
    const raw = (signed as { serialize(): Uint8Array }).serialize();
    const base64 = btoa(String.fromCharCode(...raw));
    return sendTransaction(base64);
  }, [publicKey]);

  const confirmTx = useCallback(async (sig: string, timeoutMs = 60_000): Promise<void> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const res = await fetch(`/api/solana/confirm/${encodeURIComponent(sig)}`);
      if (res.ok) {
        const body = (await res.json()) as { status: string; error?: string };
        if (body.status === "confirmed" || body.status === "finalized") return;
        if (body.status === "failed") throw new Error("Transaction failed on Solana network");
      }
      await new Promise((r) => setTimeout(r, 2_500));
    }
    throw new Error("Solana transaction confirmation timed out. Please check Solscan and submit the hash manually.");
  }, []);

  return { hasProvider, isConnected, publicKey, isConnecting, connect, disconnect, sendSol, sendSplToken, confirmTx };
}
