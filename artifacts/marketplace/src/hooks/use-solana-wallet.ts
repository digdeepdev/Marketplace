import { useState, useEffect, useCallback } from "react";

const SOL_RPC = "https://api.mainnet-beta.solana.com";

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

export interface SolanaWalletState {
  hasProvider: boolean;
  isConnected: boolean;
  publicKey: string | null;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendSol: (recipient: string, amountSol: number) => Promise<string>;
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
    const { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
    const provider = getProvider();
    if (!provider || !publicKey) throw new Error("Solana wallet not connected");

    const connection = new Connection(SOL_RPC, "confirmed");
    const fromPubkey = new PublicKey(publicKey);
    const toPubkey = new PublicKey(recipient);
    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);

    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new Transaction();
    tx.add(SystemProgram.transfer({ fromPubkey, toPubkey, lamports: BigInt(lamports) }));
    tx.recentBlockhash = blockhash;
    tx.feePayer = fromPubkey;

    const signed = await provider.signTransaction(tx);
    const raw = (signed as { serialize(): Uint8Array }).serialize();
    const sig = await connection.sendRawTransaction(raw);
    return sig;
  }, [publicKey]);

  const confirmTx = useCallback(async (sig: string, timeoutMs = 60_000): Promise<void> => {
    const { Connection } = await import("@solana/web3.js");
    const connection = new Connection(SOL_RPC, "confirmed");

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const status = await connection.getSignatureStatus(sig, { searchTransactionHistory: true });
      const conf = status.value?.confirmationStatus;
      if (conf === "confirmed" || conf === "finalized") return;
      if (status.value?.err) throw new Error("Transaction failed on Solana network");
      await new Promise((r) => setTimeout(r, 2_500));
    }
    throw new Error("Solana transaction confirmation timed out. Please check Solscan and submit the hash manually.");
  }, []);

  return { hasProvider, isConnected, publicKey, isConnecting, connect, disconnect, sendSol, confirmTx };
}
