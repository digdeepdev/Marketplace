import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone, Signal, Wallet, Loader2, RefreshCw, Database, AlertTriangle, ExternalLink, CheckCircle2, Copy, Check, ChevronDown } from "lucide-react";
import type { Product } from "./product-card";
import { FinalizeModal, type PaymentToken } from "./finalize-modal";
import { useWallet } from "@/hooks/use-wallet";
import { useSolanaWallet } from "@/hooks/use-solana-wallet";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, erc20Abi } from "viem";
import { useIsMobile } from "@/hooks/use-mobile";

// ── Constants ────────────────────────────────────────────────────────────────
const POLYGON_CHAIN_ID = 137;
const VERSE_CONTRACT = "0xc708d6f2153933daa50b2d0758955be0a93a8fec" as const;
const USDT_CONTRACT = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" as const;
const POLYGON_RECIPIENT = ((import.meta.env.VITE_POLYGON_RECIPIENT as string | undefined) ?? "0xCF882686d0f8CCB72521C7Cd3A00cfcE63BCDcC7") as `0x${string}`;
const SOL_RECIPIENT = (import.meta.env.VITE_SOL_RECIPIENT as string | undefined) ?? "GrM8dS4hk8h92UPNqfdhZn4CG1TgYUQJYBXcj7AfaQmS";
const XEC_RECIPIENT = (import.meta.env.VITE_XEC_RECIPIENT as string | undefined) ?? "ecash:qr6w9rxspfvnay2mtm3sxdxgls6fnvcf8sqzlcqly6";

// ── Module-load address validation ───────────────────────────────────────────
// Catches misconfigured VITE_POLYGON_RECIPIENT / VITE_SOL_RECIPIENT / VITE_XEC_RECIPIENT at startup.
// EIP-55 Ethereum/Polygon address: 0x + 40 hex chars
const _POLYGON_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
// Base58 alphabet (Solana): no 0, O, I, l — 32–44 characters
const _SOL_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
// eCash cashaddr: "ecash:" prefix + 40–55 lowercase base32 chars
const _XEC_ADDRESS_RE = /^ecash:[a-z0-9]{40,55}$/;

if (!_POLYGON_ADDRESS_RE.test(POLYGON_RECIPIENT)) {
  console.error(
    "[VerseKit] CONFIG ERROR: POLYGON_RECIPIENT does not look like a valid EIP-55 Polygon address " +
    "(expected 0x + 40 hex chars). Check VITE_POLYGON_RECIPIENT — payments will be sent to this value:",
    POLYGON_RECIPIENT
  );
}
if (!_SOL_ADDRESS_RE.test(SOL_RECIPIENT)) {
  console.error(
    "[VerseKit] CONFIG ERROR: SOL_RECIPIENT does not look like a valid Solana base58 address. " +
    "Check VITE_SOL_RECIPIENT — payments will be sent to this value:",
    SOL_RECIPIENT
  );
}
if (!_XEC_ADDRESS_RE.test(XEC_RECIPIENT)) {
  console.error(
    "[VerseKit] CONFIG ERROR: XEC_RECIPIENT does not look like a valid eCash cashaddr address " +
    "(expected ecash:<40-55 base32 chars>). Check VITE_XEC_RECIPIENT — payments will be sent to this value:",
    XEC_RECIPIENT
  );
}

const TOKEN_SYMBOLS: Record<PaymentToken, string> = {
  VERSE: "VERSE",
  USDT_POLYGON: "USDT",
  SOL: "SOL",
  ECASH: "XEC",
};

const TOKEN_LABELS: Record<PaymentToken, string> = {
  VERSE: "VERSE",
  USDT_POLYGON: "USDT",
  SOL: "SOL",
  ECASH: "eCash",
};

const RECIPIENT_FOR_TOKEN: Record<PaymentToken, string> = {
  VERSE: POLYGON_RECIPIENT,
  USDT_POLYGON: POLYGON_RECIPIENT,
  SOL: SOL_RECIPIENT,
  ECASH: XEC_RECIPIENT,
};

const EXPLORER_FOR_TOKEN: Record<PaymentToken, (hash: string) => string> = {
  VERSE: (h) => `https://polygonscan.com/tx/${h}`,
  USDT_POLYGON: (h) => `https://polygonscan.com/tx/${h}`,
  SOL: (h) => `https://solscan.io/tx/${h}`,
  ECASH: (h) => `https://blockchair.com/ecash/transaction/${h}`,
};

// Fallback tokenPerNaira rates (with 2% fee, approximate)
const FALLBACK_RATES: Record<PaymentToken, number> = {
  VERSE: 1.2,
  USDT_POLYGON: 0.000630,
  SOL: 0.0000042,
  ECASH: 17.99,
};

// ── API hooks ────────────────────────────────────────────────────────────────
type TokenRate = { tokenPerNaira: number; nairaPerToken: number; feePercent: number };
type AllRatesData = { verse: TokenRate; usdt: TokenRate; sol: TokenRate; ecash: TokenRate };
type EligibilityData = { eligible: boolean; balance: string; required: string } | null;

function useAllRates(enabled: boolean) {
  const [data, setData] = useState<AllRatesData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    setIsLoading(true);
    fetch("/api/prices/rates")
      .then((r) => r.json())
      .then((d) => { setData(d); setIsLoading(false); })
      .catch(() => { setIsError(true); setIsLoading(false); });
  }, [enabled]);
  return { data, isLoading, isError };
}

function useVerseBalance(walletAddress: string | undefined) {
  const [data, setData] = useState<EligibilityData>(null);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (!walletAddress) return;
    setIsLoading(true);
    fetch(`/api/paywall/verify-verse-balance?walletAddress=${walletAddress}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, [walletAddress]);
  return { data, isLoading };
}

function useConfirmPurchase() {
  const [data, setData] = useState<{ explorerUrl: string; emailSent: boolean } | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutate = (payload: { data: Record<string, unknown> }) => {
    setIsPending(true);
    setError(null);
    fetch("/api/paywall/confirm-purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload.data),
    })
      .then(async (r) => {
        const d = (await r.json()) as { confirmed?: boolean; explorerUrl?: string; emailSent?: boolean; error?: string };
        if (!r.ok || d.confirmed === false) {
          setError(d.error ?? "Transaction could not be verified on-chain.");
          setIsPending(false);
        } else {
          setData({ explorerUrl: d.explorerUrl ?? "", emailSent: d.emailSent ?? false });
          setIsPending(false);
        }
      })
      .catch((e: Error) => { setError(e.message); setIsPending(false); });
  };
  return { mutate, data, isPending, error };
}

// ── Data plans ───────────────────────────────────────────────────────────────
type PurchaseType = "airtime" | "data";
type DataPlanCategory = "daily" | "weekly" | "monthly";
type DataPlan = {
  id: string;
  category: DataPlanCategory;
  label: string;
  dataValue: string;
  price: number;
  validity: string;
};

const NETWORK_DATA_PLANS: Record<string, DataPlan[]> = {
  MTN: [
    { id: "d1",  category: "daily", label: "110MB — 1 Day",                 dataValue: "110MB",               price: 100,   validity: "1 day" },
    { id: "d2",  category: "daily", label: "230MB — 1 Day",                 dataValue: "230MB",               price: 200,   validity: "1 day" },
    { id: "d3",  category: "daily", label: "500MB — 1 Day",                 dataValue: "500MB",               price: 350,   validity: "1 day" },
    { id: "d4",  category: "daily", label: "1GB + 1.5 Mins — 1 Day",       dataValue: "1GB + 1.5 Mins",      price: 500,   validity: "1 day" },
    { id: "d5",  category: "daily", label: "1.5GB — 2 Days",                dataValue: "1.5GB",               price: 600,   validity: "2 days" },
    { id: "d6",  category: "daily", label: "2GB — 2 Days",                  dataValue: "2GB",                 price: 750,   validity: "2 days" },
    { id: "d7",  category: "daily", label: "2.5GB — 1 Day",                 dataValue: "2.5GB",               price: 750,   validity: "1 day" },
    { id: "d8",  category: "daily", label: "2.5GB — 2 Days",                dataValue: "2.5GB",               price: 900,   validity: "2 days" },
    { id: "d9",  category: "daily", label: "3.2GB — 2 Days",                dataValue: "3.2GB",               price: 1000,  validity: "2 days" },
    { id: "d10", category: "daily", label: "3.5GB — 1 Day",                 dataValue: "3.5GB",               price: 1000,  validity: "1 day" },
    { id: "d11", category: "daily", label: "4GB — 2 Days",                  dataValue: "4GB",                 price: 1200,  validity: "2 days" },
    { id: "d12", category: "daily", label: "5.5GB — 2 Days",                dataValue: "5.5GB",               price: 1500,  validity: "2 days" },
    { id: "w1",  category: "weekly", label: "600MB Xtra — 7 Days",          dataValue: "600MB Xtra Bundle",   price: 500,   validity: "7 days" },
    { id: "w2",  category: "weekly", label: "500MB + 1GB YouTube — 7 Days", dataValue: "500MB + 1GB YouTube", price: 500,   validity: "7 days" },
    { id: "w3",  category: "weekly", label: "600MB + 2 Mins — 7 Days",      dataValue: "600MB + 2 Mins",      price: 500,   validity: "7 days" },
    { id: "w4",  category: "weekly", label: "1.5GB — 7 Days",               dataValue: "1.5GB",               price: 1000,  validity: "7 days" },
    { id: "w5",  category: "weekly", label: "1.8GB Xtra — 7 Days",          dataValue: "1.8GB Xtra Bundle",   price: 1500,  validity: "7 days" },
    { id: "w6",  category: "weekly", label: "3.5GB — 7 Days",               dataValue: "3.5GB",               price: 1500,  validity: "7 days" },
    { id: "w7",  category: "weekly", label: "6GB — 7 Days",                 dataValue: "6GB",                 price: 2500,  validity: "7 days" },
    { id: "w8",  category: "weekly", label: "11GB — 7 Days",                dataValue: "11GB",                price: 3500,  validity: "7 days" },
    { id: "w9",  category: "weekly", label: "15GB — 7 Days",                dataValue: "15GB",                price: 4000,  validity: "7 days" },
    { id: "w10", category: "weekly", label: "12.5GB — 14 Days",             dataValue: "12.5GB",              price: 4500,  validity: "14 days" },
    { id: "w11", category: "weekly", label: "20GB — 7 Days",                dataValue: "20GB",                price: 5000,  validity: "7 days" },
    { id: "w12", category: "weekly", label: "18GB — 14 Days",               dataValue: "18GB",                price: 6000,  validity: "14 days" },
    { id: "w13", category: "weekly", label: "28GB — 14 Days",               dataValue: "28GB",                price: 8000,  validity: "14 days" },
    { id: "w14", category: "weekly", label: "40GB — 14 Days",               dataValue: "40GB",                price: 10000, validity: "14 days" },
    { id: "m1",  category: "monthly", label: "2GB + 2 Mins — 30 Days",      dataValue: "2GB + 2 Mins",        price: 1500,  validity: "30 days" },
    { id: "m2",  category: "monthly", label: "2.7GB + 2 Mins — 30 Days",    dataValue: "2.7GB + 2 Mins",      price: 2000,  validity: "30 days" },
    { id: "m3",  category: "monthly", label: "3.5GB + 5 Mins — 30 Days",    dataValue: "3.5GB + 5 Mins",      price: 2500,  validity: "30 days" },
    { id: "m4",  category: "monthly", label: "2.7GB Xtra — 30 Days",        dataValue: "2.7GB Xtra Bundle",   price: 3000,  validity: "30 days" },
    { id: "m5",  category: "monthly", label: "6.75GB — 30 Days",            dataValue: "6.75GB",              price: 3000,  validity: "30 days" },
    { id: "m6",  category: "monthly", label: "7GB — 30 Days",               dataValue: "7GB",                 price: 3500,  validity: "30 days" },
    { id: "m7",  category: "monthly", label: "10GB + 10 Mins — 30 Days",    dataValue: "10GB + 10 Mins",      price: 4500,  validity: "30 days" },
    { id: "m8",  category: "monthly", label: "12.5GB — 30 Days",            dataValue: "12.5GB",              price: 5500,  validity: "30 days" },
    { id: "m9",  category: "monthly", label: "14.5GB — 30 Days",            dataValue: "14.5GB",              price: 6000,  validity: "30 days" },
    { id: "m10", category: "monthly", label: "20GB — 30 Days",              dataValue: "20GB",                price: 7500,  validity: "30 days" },
    { id: "m11", category: "monthly", label: "34GB — 30 Days",              dataValue: "34GB",                price: 10000, validity: "30 days" },
    { id: "m12", category: "monthly", label: "36GB — 30 Days",              dataValue: "36GB",                price: 11000, validity: "30 days" },
    { id: "m13", category: "monthly", label: "65GB — 30 Days",              dataValue: "65GB",                price: 16000, validity: "30 days" },
    { id: "m14", category: "monthly", label: "75GB — 30 Days",              dataValue: "75GB",                price: 18000, validity: "30 days" },
    { id: "m15", category: "monthly", label: "125GB — 30 Days",             dataValue: "120GB + 5GB Bonus",   price: 24000, validity: "30 days" },
    { id: "m16", category: "monthly", label: "165GB — 30 Days",             dataValue: "165GB",               price: 35000, validity: "30 days" },
    { id: "m17", category: "monthly", label: "150GB — 60 Days",             dataValue: "150GB",               price: 40000, validity: "60 days" },
  ],
  Airtel: [
    { id: "ad1",  category: "daily", label: "75MB — 1 Day",                      dataValue: "75MB",                     price: 75,    validity: "1 day" },
    { id: "ad2",  category: "daily", label: "110MB — 1 Day",                     dataValue: "110MB",                    price: 100,   validity: "1 day" },
    { id: "ad3",  category: "daily", label: "250MB Night Plan (12–5am) — 1 Day", dataValue: "250MB (12am–5am)",         price: 100,   validity: "1 day" },
    { id: "ad4",  category: "daily", label: "200MB Social — 2 Days",             dataValue: "200MB Social Plan",        price: 100,   validity: "2 days" },
    { id: "ad5",  category: "daily", label: "1GB Social — 3 Days",               dataValue: "1GB Social Plan",          price: 300,   validity: "3 days" },
    { id: "ad6",  category: "daily", label: "1GB Binge — 1 Day",                 dataValue: "1GB Binge Plan",           price: 500,   validity: "1 day" },
    { id: "ad7",  category: "daily", label: "2GB — 2 Days",                      dataValue: "2GB",                      price: 600,   validity: "2 days" },
    { id: "ad8",  category: "daily", label: "3GB — 2 Days",                      dataValue: "3GB",                      price: 750,   validity: "2 days" },
    { id: "ad9",  category: "daily", label: "4GB — 2 Days",                      dataValue: "4GB",                      price: 1000,  validity: "2 days" },
    { id: "ad10", category: "daily", label: "6GB — 1 Day",                       dataValue: "6GB",                      price: 1500,  validity: "1 day" },
    { id: "aw1",  category: "weekly", label: "1GB — 7 Days",                     dataValue: "1GB",                      price: 800,   validity: "7 days" },
    { id: "aw2",  category: "weekly", label: "1.5GB — 7 Days",                   dataValue: "1.5GB",                    price: 1000,  validity: "7 days" },
    { id: "aw3",  category: "weekly", label: "4GB — 7 Days",                     dataValue: "4GB",                      price: 1500,  validity: "7 days" },
    { id: "aw4",  category: "weekly", label: "6GB — 7 Days",                     dataValue: "6GB",                      price: 2000,  validity: "7 days" },
    { id: "aw5",  category: "weekly", label: "8GB — 7 Days",                     dataValue: "8GB",                      price: 2500,  validity: "7 days" },
    { id: "aw6",  category: "weekly", label: "10GB — 7 Days",                    dataValue: "10GB",                     price: 3000,  validity: "7 days" },
    { id: "aw7",  category: "weekly", label: "20GB — 7 Days",                    dataValue: "20GB",                     price: 5000,  validity: "7 days" },
    { id: "am1",  category: "monthly", label: "2GB — 30 Days",                   dataValue: "2GB",                      price: 1500,  validity: "30 days" },
    { id: "am2",  category: "monthly", label: "3GB — 30 Days",                   dataValue: "3GB",                      price: 2000,  validity: "30 days" },
    { id: "am3",  category: "monthly", label: "4GB — 30 Days",                   dataValue: "4GB",                      price: 2500,  validity: "30 days" },
    { id: "am4",  category: "monthly", label: "8GB — 30 Days",                   dataValue: "8GB",                      price: 3000,  validity: "30 days" },
    { id: "am5",  category: "monthly", label: "10GB — 30 Days",                  dataValue: "10GB",                     price: 4000,  validity: "30 days" },
    { id: "am6",  category: "monthly", label: "13GB — 30 Days",                  dataValue: "13GB",                     price: 5000,  validity: "30 days" },
    { id: "am7",  category: "monthly", label: "18GB — 30 Days",                  dataValue: "18GB",                     price: 6000,  validity: "30 days" },
    { id: "am8",  category: "monthly", label: "25GB — 30 Days",                  dataValue: "25GB",                     price: 8000,  validity: "30 days" },
    { id: "am9",  category: "monthly", label: "35GB — 30 Days",                  dataValue: "35GB",                     price: 10000, validity: "30 days" },
    { id: "am10", category: "monthly", label: "60GB — 30 Days",                  dataValue: "60GB",                     price: 15000, validity: "30 days" },
    { id: "am11", category: "monthly", label: "100GB — 30 Days",                 dataValue: "100GB",                    price: 20000, validity: "30 days" },
    { id: "am12", category: "monthly", label: "160GB — 30 Days",                 dataValue: "160GB",                    price: 30000, validity: "30 days" },
    { id: "am13", category: "monthly", label: "210GB — 30 Days",                 dataValue: "210GB",                    price: 40000, validity: "30 days" },
  ],
  Glo: [
    { id: "gd1",  category: "daily", label: "45MB — 1 Day",                              dataValue: "45MB",                              price: 50,    validity: "1 day" },
    { id: "gd2",  category: "daily", label: "135MB Social Bundle — 3 Nights",            dataValue: "135MB Social Bundle",               price: 50,    validity: "3 nights" },
    { id: "gd3",  category: "daily", label: "350MB Night Plan — 1 Night",                dataValue: "350MB Night Plan",                  price: 60,    validity: "1 night" },
    { id: "gd4",  category: "daily", label: "125MB — 1 Day (120MB + 5MB Night)",         dataValue: "120MB + 5MB Night",                 price: 100,   validity: "1 day" },
    { id: "gd5",  category: "daily", label: "300MB Social — 1 Day (MyG)",                dataValue: "300MB MyG Social Bundle",           price: 100,   validity: "1 day" },
    { id: "gd6",  category: "daily", label: "245MB Campus Booster — 1 Day",              dataValue: "240MB + 5MB Night",                 price: 100,   validity: "1 day" },
    { id: "gd7",  category: "daily", label: "750MB Night Plan — 1 Night",                dataValue: "750MB Night Plan",                  price: 120,   validity: "1 night" },
    { id: "gd8",  category: "daily", label: "275MB — 2 Days (250MB + 25MB Night)",       dataValue: "250MB + 25MB Night",                price: 200,   validity: "2 days" },
    { id: "gd9",  category: "daily", label: "525MB Campus Booster — 2 Days",             dataValue: "500MB + 25MB Night",                price: 200,   validity: "2 days" },
    { id: "gd10", category: "daily", label: "1GB Social — 3 Days (MyG)",                 dataValue: "1GB MyG Social Bundle",             price: 300,   validity: "3 days" },
    { id: "gd11", category: "daily", label: "1.1GB Social Bundle — 10 Nights",           dataValue: "1.1GB Social Bundle",               price: 300,   validity: "10 nights" },
    { id: "gd12", category: "daily", label: "2GB Special — 1 Day",                       dataValue: "2GB",                               price: 500,   validity: "1 day" },
    { id: "gd13", category: "daily", label: "1.8GB Social Bundle — 15 Nights",           dataValue: "1.8GB Social Bundle",               price: 500,   validity: "15 nights" },
    { id: "gd14", category: "daily", label: "3.55GB — 2 Days",                           dataValue: "3.55GB",                            price: 600,   validity: "2 days" },
    { id: "gd15", category: "daily", label: "5.1GB Special — 2 Days",                    dataValue: "5.1GB",                             price: 1000,  validity: "2 days" },
    { id: "gw1",  category: "weekly", label: "335MB Social Bundle — 7 Nights",           dataValue: "335MB Social Bundle",               price: 100,   validity: "7 nights" },
    { id: "gw2",  category: "weekly", label: "1.55GB — 7 Days (550MB + 1GB Night)",      dataValue: "550MB + 1GB Night",                 price: 500,   validity: "7 days" },
    { id: "gw3",  category: "weekly", label: "2.1GB Campus Booster — 7 Days",            dataValue: "1.1GB + 1GB Night",                 price: 500,   validity: "7 days" },
    { id: "gw4",  category: "weekly", label: "3.7GB — 7 Days (1.7GB + 2GB Night)",       dataValue: "1.7GB + 2GB Night",                 price: 1000,  validity: "7 days" },
    { id: "gw5",  category: "weekly", label: "6GB Special — 7 Days (4GB + 2GB Night)",   dataValue: "4GB + 2GB Night",                   price: 1500,  validity: "7 days" },
    { id: "gw6",  category: "weekly", label: "9GB — 7 Days (6.5GB + 2.5GB Night)",       dataValue: "6.5GB + 2.5GB Night",               price: 2000,  validity: "7 days" },
    { id: "gm1",  category: "monthly", label: "4.2GB Campus Booster — 30 Days",          dataValue: "2.2GB + 2GB Night",                 price: 1000,  validity: "30 days" },
    { id: "gm2",  category: "monthly", label: "5.2GB — 30 Days (2.2GB + 3GB Night)",     dataValue: "2.2GB + 3GB Night",                 price: 1500,  validity: "30 days" },
    { id: "gm3",  category: "monthly", label: "6.25GB — 30 Days (3.25GB + 3GB Night)",   dataValue: "3.25GB + 3GB Night",                price: 2000,  validity: "30 days" },
    { id: "gm4",  category: "monthly", label: "10GB Campus Booster — 30 Days",           dataValue: "6.5GB + 3.5GB Night",               price: 2000,  validity: "30 days" },
    { id: "gm5",  category: "monthly", label: "7.25GB — 30 Days (4.25GB + 3GB Night)",   dataValue: "4.25GB + 3GB Night",                price: 2500,  validity: "30 days" },
    { id: "gm6",  category: "monthly", label: "10.5GB — 30 Days (8.5GB + 2GB Night)",    dataValue: "8.5GB + 2GB Night",                 price: 3000,  validity: "30 days" },
    { id: "gm7",  category: "monthly", label: "17GB — 30 Days (14.5GB + 2.5GB Night)",   dataValue: "14.5GB + 2.5GB Night",              price: 5000,  validity: "30 days" },
    { id: "gm8",  category: "monthly", label: "30GB Campus Booster — 30 Days",           dataValue: "27GB + 3GB Night",                  price: 5000,  validity: "30 days" },
    { id: "gm9",  category: "monthly", label: "42GB — 30 Days (38GB + 4GB Night)",       dataValue: "38GB + 4GB Night",                  price: 10000, validity: "30 days" },
  ],
  "T2 Mobile": [
    { id: "td1", category: "daily", label: "40MB — 1 Day",       dataValue: "40MB",    price: 50,    validity: "1 day" },
    { id: "td2", category: "daily", label: "83MB — 1 Day",       dataValue: "83MB",    price: 100,   validity: "1 day" },
    { id: "td3", category: "daily", label: "150MB — 1 Day",      dataValue: "150MB",   price: 200,   validity: "1 day" },
    { id: "tw1", category: "weekly", label: "650MB — 7 Days",    dataValue: "650MB",   price: 500,   validity: "7 days" },
    { id: "tw2", category: "weekly", label: "3.4GB — 7 Days",    dataValue: "3.4GB",   price: 1500,  validity: "7 days" },
    { id: "tm1",  category: "monthly", label: "2GB — 30 Days",   dataValue: "2GB",     price: 1000,  validity: "30 days" },
    { id: "tm2",  category: "monthly", label: "2.3GB — 30 Days", dataValue: "2.3GB",   price: 1200,  validity: "30 days" },
    { id: "tm3",  category: "monthly", label: "4.5GB — 30 Days", dataValue: "4.5GB",   price: 2000,  validity: "30 days" },
    { id: "tm4",  category: "monthly", label: "5.2GB — 30 Days", dataValue: "5.2GB",   price: 2500,  validity: "30 days" },
    { id: "tm5",  category: "monthly", label: "6.2GB — 30 Days", dataValue: "6.2GB",   price: 3000,  validity: "30 days" },
    { id: "tm6",  category: "monthly", label: "8.4GB — 30 Days", dataValue: "8.4GB",   price: 4000,  validity: "30 days" },
    { id: "tm7",  category: "monthly", label: "11.4GB — 30 Days",dataValue: "11.4GB",  price: 5000,  validity: "30 days" },
    { id: "tm8",  category: "monthly", label: "23GB — 30 Days",  dataValue: "23GB",    price: 10000, validity: "30 days" },
    { id: "tm9",  category: "monthly", label: "35GB — 30 Days",  dataValue: "35GB",    price: 15000, validity: "30 days" },
    { id: "tm10", category: "monthly", label: "47GB — 30 Days",  dataValue: "47GB",    price: 20000, validity: "30 days" },
    { id: "tm11", category: "monthly", label: "118GB — 30 Days", dataValue: "118GB",   price: 50000, validity: "30 days" },
  ],
};

const CATEGORY_LABELS: Record<DataPlanCategory, string> = {
  daily: "Daily Plans",
  weekly: "Weekly Plans",
  monthly: "Monthly Plans",
};

// ── Props ────────────────────────────────────────────────────────────────────
interface AirtimeModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}

type TxStatus = "idle" | "sending" | "confirming" | "verifying" | "completed" | "failed";

// ── Component ────────────────────────────────────────────────────────────────
export function AirtimeModal({ product, open, onClose }: AirtimeModalProps) {
  const [paymentToken, setPaymentToken] = useState<PaymentToken>("VERSE");
  const [purchaseType, setPurchaseType] = useState<PurchaseType>("airtime");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [confirmResult, setConfirmResult] = useState<{ explorerUrl: string; emailSent: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showFinalize, setShowFinalize] = useState(false);

  const isMobile = useIsMobile();
  const { address, chainId, isConnected, isConnecting, connect } = useWallet();
  const solanaWallet = useSolanaWallet();
  const dataPlans = NETWORK_DATA_PLANS[product?.name ?? ""] ?? [];
  const selectedPlan = dataPlans.find((p) => p.id === selectedPlanId);

  const { writeContract, isPending: isSending } = useWriteContract();
  const { data: receipt, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash && (paymentToken === "VERSE" || paymentToken === "USDT_POLYGON") ? (txHash as `0x${string}`) : undefined,
  });

  const { data: ratesData, isLoading: rateLoading, isError: rateError } = useAllRates(open);

  const isOnPolygon = chainId === POLYGON_CHAIN_ID;

  const verifyBalanceAddress = isConnected && isOnPolygon && address && paymentToken === "VERSE" ? address : undefined;
  const { data: eligibilityData, isLoading: isVerifying } = useVerseBalance(verifyBalanceAddress);

  const { mutate: confirmPurchase, data: confirmData, isPending: isConfirmingBackend, error: confirmError } = useConfirmPurchase();

  // ── Resets ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setPurchaseType("airtime");
      setPhoneNumber("");
      setAmount("");
      setSelectedPlanId("");
      setTxStatus("idle");
      setTxHash(null);
      setTxError(null);
      setConfirmResult(null);
      setCopied(false);
      setShowFinalize(false);
    }
  }, [open]);

  useEffect(() => {
    if (purchaseType === "data" && selectedPlan) {
      setAmount(selectedPlan.price.toString());
    }
  }, [purchaseType, selectedPlan]);

  useEffect(() => {
    if (purchaseType === "airtime") {
      setSelectedPlanId("");
    }
  }, [purchaseType]);

  // Reset tx state when switching tokens
  useEffect(() => {
    setTxStatus("idle");
    setTxHash(null);
    setTxError(null);
    setConfirmResult(null);
  }, [paymentToken]);

  // Monitor chain confirmation (EVM tokens)
  useEffect(() => {
    if (receipt && txHash && txStatus === "confirming") {
      if (receipt.status === "success") {
        setTxStatus("verifying");
        const naira = parseFloat(amount) || 0;
        const tokenAmountStr = tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 18, useGrouping: false });
        confirmPurchase({
          data: {
            txHash,
            walletAddress: address!,
            purchaseType,
            phoneNumber,
            nairaAmount: naira,
            verseAmount: tokenAmountStr,
            network: product?.name ?? "N/A",
            dataPlan: selectedPlan?.label ?? undefined,
            txUrl: EXPLORER_FOR_TOKEN[paymentToken](txHash),
            paymentToken,
          },
        });
      } else {
        setTxStatus("failed");
        setTxError("Transaction failed on-chain. Please try again.");
      }
    }
  }, [receipt, txHash, txStatus]);

  // Monitor backend confirmation
  useEffect(() => {
    if (confirmData && txStatus === "verifying") {
      setTxStatus("completed");
      setConfirmResult({ explorerUrl: confirmData.explorerUrl, emailSent: confirmData.emailSent });
    }
  }, [confirmData]);

  // Handle backend verification failure
  useEffect(() => {
    if (confirmError && txStatus === "verifying") {
      setTxStatus("failed");
      setTxError(confirmError);
    }
  }, [confirmError, txStatus]);

  if (!product) return null;

  // ── Derived values ─────────────────────────────────────────────────────────
  const nairaAmount = parseFloat(amount) || 0;
  const rateKey = { VERSE: "verse", USDT_POLYGON: "usdt", SOL: "sol", ECASH: "ecash" } as const;
  const currentRate = ratesData?.[rateKey[paymentToken]]?.tokenPerNaira ?? FALLBACK_RATES[paymentToken];
  const feePercent = ratesData?.[rateKey[paymentToken]]?.feePercent ?? 2;
  const tokenAmount = nairaAmount * currentRate;
  const tokenSymbol = TOKEN_SYMBOLS[paymentToken];
  const recipientAddress = RECIPIENT_FOR_TOKEN[paymentToken];

  const isFormValid = phoneNumber.length >= 10 && nairaAmount >= 100;
  const isEligible = paymentToken === "VERSE" ? eligibilityData?.eligible === true : true;
  const isBusy = txStatus !== "idle" && txStatus !== "completed" && txStatus !== "failed";
  const isCompleted = txStatus === "completed";
  const isFailed = txStatus === "failed";

  // Show QR for: mobile (all tokens), desktop eCash, or desktop SOL with no injected wallet
  const showQRFlow = isMobile || paymentToken === "ECASH" || (paymentToken === "SOL" && !solanaWallet.hasProvider);

  const shortAddress = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
  const balanceShortfall =
    eligibilityData && !eligibilityData.eligible
      ? (parseFloat(eligibilityData.required) - parseFloat(eligibilityData.balance)).toLocaleString(undefined, { maximumFractionDigits: 2 })
      : null;

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleSwitchToPolygon() {
    const eth = (window as unknown as { ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<unknown> } }).ethereum;
    if (!eth) return;
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x89" }] });
    } catch (switchErr: unknown) {
      const err = switchErr as { code?: number };
      if (err?.code === 4902) {
        try {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x89",
              chainName: "Polygon Mainnet",
              nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
              rpcUrls: ["https://rpc.ankr.com/polygon"],
              blockExplorerUrls: ["https://polygonscan.com"],
            }],
          });
        } catch { /* ignore */ }
      }
    }
  }

  function handleEVMSpend() {
    if (!address || !isOnPolygon) return;
    setTxError(null);
    setTxStatus("sending");
    setConfirmResult(null);

    const tokenAmountStr = tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 18, useGrouping: false });

    if (paymentToken === "VERSE") {
      const rawAmount = parseUnits(tokenAmountStr, 18);
      writeContract(
        { address: VERSE_CONTRACT, abi: erc20Abi, functionName: "transfer", args: [POLYGON_RECIPIENT, rawAmount] },
        {
          onSuccess: (hash) => { setTxHash(hash); setTxStatus("confirming"); },
          onError: (err) => { setTxStatus("failed"); setTxError(err.message || "Transaction failed to submit"); },
        },
      );
    } else if (paymentToken === "USDT_POLYGON") {
      const rawAmount = parseUnits(tokenAmountStr, 6);
      writeContract(
        { address: USDT_CONTRACT, abi: erc20Abi, functionName: "transfer", args: [POLYGON_RECIPIENT, rawAmount] },
        {
          onSuccess: (hash) => { setTxHash(hash); setTxStatus("confirming"); },
          onError: (err) => { setTxStatus("failed"); setTxError(err.message || "Transaction failed to submit"); },
        },
      );
    }
  }

  async function handleSolSpend() {
    setTxError(null);
    setTxStatus("sending");
    setConfirmResult(null);
    try {
      const sig = await solanaWallet.sendSol(SOL_RECIPIENT, tokenAmount);
      setTxHash(sig);
      setTxStatus("confirming");
      await solanaWallet.confirmTx(sig);
      setTxStatus("verifying");
      const tokenAmountStr = tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 9, useGrouping: false });
      confirmPurchase({
        data: {
          txHash: sig,
          walletAddress: solanaWallet.publicKey ?? undefined,
          purchaseType,
          phoneNumber,
          nairaAmount,
          verseAmount: tokenAmountStr,
          network: product?.name ?? "N/A",
          dataPlan: selectedPlan?.label ?? undefined,
          txUrl: EXPLORER_FOR_TOKEN.SOL(sig),
          paymentToken: "SOL",
        },
      });
    } catch (err) {
      setTxStatus("failed");
      setTxError(err instanceof Error ? err.message : "SOL transfer failed");
    }
  }

  function handleFinalizeConfirm(trimmedHash: string) {
    setTxError(null);
    setTxHash(trimmedHash);
    setTxStatus("verifying");
    setConfirmResult(null);
    const tokenAmountStr = tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 18, useGrouping: false });
    confirmPurchase({
      data: {
        txHash: trimmedHash,
        walletAddress: paymentToken === "SOL" ? (solanaWallet.publicKey ?? undefined) : (address ?? undefined),
        purchaseType,
        phoneNumber,
        nairaAmount,
        verseAmount: tokenAmountStr,
        network: product?.name ?? "N/A",
        dataPlan: selectedPlan?.label ?? undefined,
        txUrl: EXPLORER_FOR_TOKEN[paymentToken](trimmedHash),
        paymentToken,
      },
    });
  }

  // ── Wallet section renderer ────────────────────────────────────────────────
  function renderWalletSection() {
    if (showQRFlow) {
      const payLabel =
        paymentToken === "VERSE" ? "Pay with VERSE (Polygon)" :
        paymentToken === "USDT_POLYGON" ? "Pay with USDT (Polygon)" :
        paymentToken === "SOL" ? "Pay with SOL (Solana)" :
        "Pay with eCash (XEC)";
      return (
        <>
          <div className="flex items-center gap-2">
            <Wallet className="h-3.5 w-3.5 text-[#06B6D4] shrink-0" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              {payLabel}
            </span>
          </div>
          <div className="flex flex-col items-center gap-2 w-full">
            <div className="bg-white p-1.5 rounded-lg max-w-full">
              <QRCodeSVG value={recipientAddress} size={120} level="M" includeMargin={false} className="max-w-full h-auto" />
            </div>
            <div className="flex items-center gap-2 w-full min-w-0">
              <code className="flex-1 min-w-0 text-[10px] text-muted-foreground font-mono truncate bg-black/20 rounded px-2 py-1">
                {recipientAddress}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[10px] text-[#06B6D4] hover:text-[#06B6D4] hover:bg-[#06B6D4]/10 shrink-0"
                onClick={async () => {
                  await navigator.clipboard.writeText(recipientAddress);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              {paymentToken === "VERSE" && tokenAmount > 0
                ? `Scan or copy the address, then send ${tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} VERSE on Polygon`
                : paymentToken === "USDT_POLYGON" && tokenAmount > 0
                ? `Scan or copy the address, then send ${tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} USDT on Polygon`
                : paymentToken === "SOL" && tokenAmount > 0
                ? `Scan or copy the address, then send ${tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} SOL on Solana`
                : paymentToken === "ECASH" && tokenAmount > 0
                ? `Scan or copy the address, then send ${tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} XEC`
                : "Scan or copy the address to send payment"}
            </p>
          </div>
        </>
      );
    }

    // Desktop EVM flow (VERSE / USDT)
    if (paymentToken === "VERSE" || paymentToken === "USDT_POLYGON") {
      return (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5 text-[#06B6D4] shrink-0" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Wallet (Polygon)</span>
            </div>
            {isConnected && <span className="text-[10px] text-muted-foreground font-mono">{shortAddress}</span>}
          </div>
          {!isConnected ? (
            <Button
              size="sm" variant="outline"
              className="w-full h-8 text-xs border-[#06B6D4]/40 text-[#06B6D4] hover:bg-[#06B6D4]/10 hover:text-[#06B6D4]"
              onClick={connect} disabled={isConnecting || isBusy}
            >
              {isConnecting
                ? <><Loader2 className="h-3 w-3 animate-spin mr-1.5" />Connecting…</>
                : <><Wallet className="h-3 w-3 mr-1.5" />Connect Wallet</>}
            </Button>
          ) : !isOnPolygon ? (
            <Button
              size="sm" variant="outline"
              className="w-full h-8 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-400"
              onClick={handleSwitchToPolygon} disabled={isBusy}
            >
              <AlertTriangle className="h-3 w-3 mr-1.5" />Switch to Polygon
            </Button>
          ) : paymentToken === "VERSE" && isVerifying ? (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />Checking VERSE balance…
            </div>
          ) : paymentToken === "VERSE" && eligibilityData ? (
            isEligible ? (
              <div className="flex items-center gap-1.5 text-[11px] text-[#06B6D4]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#06B6D4] shrink-0" />
                {parseFloat(eligibilityData.balance).toLocaleString(undefined, { maximumFractionDigits: 2 })} VERSE — eligible to spend
              </div>
            ) : (
              <div className="flex items-start gap-1.5 text-[11px] text-amber-400">
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                <span>
                  You need at least 2,000 VERSE on Polygon to spend.{" "}
                  {balanceShortfall && <span className="text-amber-400/70">({balanceShortfall} VERSE short)</span>}
                </span>
              </div>
            )
          ) : (
            <div className="text-[11px] text-[#06B6D4] flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#06B6D4] shrink-0" />
              Connected to Polygon
            </div>
          )}
        </>
      );
    }

    // Desktop SOL flow
    if (paymentToken === "SOL") {
      return (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5 text-[#06B6D4] shrink-0" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Wallet (Solana)</span>
            </div>
            {solanaWallet.isConnected && solanaWallet.publicKey && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {solanaWallet.publicKey.slice(0, 4)}…{solanaWallet.publicKey.slice(-4)}
              </span>
            )}
          </div>
          {!solanaWallet.hasProvider ? (
            <Button
              size="sm" variant="outline"
              className="w-full h-8 text-xs border-[#06B6D4]/40 text-[#06B6D4] hover:bg-[#06B6D4]/10 hover:text-[#06B6D4]"
              onClick={() => window.open("https://phantom.app/", "_blank")}
            >
              <Wallet className="h-3 w-3 mr-1.5" />Install Phantom / Solflare
            </Button>
          ) : !solanaWallet.isConnected ? (
            <Button
              size="sm" variant="outline"
              className="w-full h-8 text-xs border-[#06B6D4]/40 text-[#06B6D4] hover:bg-[#06B6D4]/10 hover:text-[#06B6D4]"
              onClick={solanaWallet.connect} disabled={solanaWallet.isConnecting || isBusy}
            >
              {solanaWallet.isConnecting
                ? <><Loader2 className="h-3 w-3 animate-spin mr-1.5" />Connecting…</>
                : <><Wallet className="h-3 w-3 mr-1.5" />Connect Solana Wallet</>}
            </Button>
          ) : (
            <div className="text-[11px] text-[#06B6D4] flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#06B6D4] shrink-0" />
              Solana wallet connected
            </div>
          )}
        </>
      );
    }

    return null;
  }

  // ── Spend button renderer ──────────────────────────────────────────────────
  function renderSpendButton() {
    if (showQRFlow) {
      return (
        <Button
          className="w-full bg-[#06B6D4] text-black border-0 font-semibold h-11 hover:bg-[#0891B2]"
          disabled={!isFormValid || isBusy}
          onClick={() => { if (isFormValid) setShowFinalize(true); }}
        >
          <CheckCircle2 className="h-4 w-4 mr-1.5" />Confirm Purchase
        </Button>
      );
    }

    if (paymentToken === "VERSE") {
      const canSpend = isFormValid && isConnected && isOnPolygon && !isVerifying && isEligible;
      return (
        <>
          <Button
            className="w-full btn-gradient text-white border-0 font-semibold h-11"
            disabled={!canSpend || isBusy}
            onClick={handleEVMSpend}
          >
            {isSending ? <><Loader2 className="h-4 w-4 animate-spin" />Awaiting wallet…</>
              : isConfirming ? <><Loader2 className="h-4 w-4 animate-spin" />Confirming…</>
              : isConfirmingBackend ? <><Loader2 className="h-4 w-4 animate-spin" />Verifying…</>
              : isCompleted ? <><CheckCircle2 className="h-4 w-4 mr-1.5" />Confirmed</>
              : <><Wallet className="h-4 w-4 mr-1.5" />Spend {tokenAmount > 0 ? `${tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} VERSE` : ""}</>}
          </Button>
          {isConnected && isOnPolygon && eligibilityData && !isEligible && (
            <p className="text-[11px] text-amber-400/80 text-center">You need at least 2,000 VERSE on Polygon to spend</p>
          )}
          {isConnected && !isOnPolygon && (
            <p className="text-[11px] text-amber-400/80 text-center">Switch your wallet to Polygon network to continue</p>
          )}
          {!isConnected && (
            <p className="text-[11px] text-muted-foreground text-center">Connect your wallet to enable spending</p>
          )}
        </>
      );
    }

    if (paymentToken === "USDT_POLYGON") {
      const canSpend = isFormValid && isConnected && isOnPolygon;
      return (
        <>
          <Button
            className="w-full btn-gradient text-white border-0 font-semibold h-11"
            disabled={!canSpend || isBusy}
            onClick={handleEVMSpend}
          >
            {isSending ? <><Loader2 className="h-4 w-4 animate-spin" />Awaiting wallet…</>
              : isConfirming ? <><Loader2 className="h-4 w-4 animate-spin" />Confirming…</>
              : isConfirmingBackend ? <><Loader2 className="h-4 w-4 animate-spin" />Verifying…</>
              : isCompleted ? <><CheckCircle2 className="h-4 w-4 mr-1.5" />Confirmed</>
              : <><Wallet className="h-4 w-4 mr-1.5" />Spend {tokenAmount > 0 ? `${tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} USDT` : ""}</>}
          </Button>
          {isConnected && !isOnPolygon && (
            <p className="text-[11px] text-amber-400/80 text-center">Switch your wallet to Polygon network to continue</p>
          )}
          {!isConnected && (
            <p className="text-[11px] text-muted-foreground text-center">Connect your wallet to enable spending</p>
          )}
        </>
      );
    }

    if (paymentToken === "SOL") {
      const canSpend = isFormValid && solanaWallet.isConnected;
      return (
        <>
          <Button
            className="w-full btn-gradient text-white border-0 font-semibold h-11"
            disabled={!canSpend || isBusy}
            onClick={handleSolSpend}
          >
            {txStatus === "sending" ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Awaiting wallet…</>
              : txStatus === "confirming" ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Confirming on Solana…</>
              : isConfirmingBackend ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Verifying…</>
              : isCompleted ? <><CheckCircle2 className="h-4 w-4 mr-1.5" />Confirmed</>
              : <><Wallet className="h-4 w-4 mr-1.5" />Spend {tokenAmount > 0 ? `${tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} SOL` : ""}</>}
          </Button>
          {!solanaWallet.isConnected && solanaWallet.hasProvider && (
            <p className="text-[11px] text-muted-foreground text-center">Connect your Solana wallet to enable spending</p>
          )}
        </>
      );
    }

    return null;
  }

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-[95vw] sm:max-w-[700px] border-white/5 bg-card/95 backdrop-blur-xl p-0 !rounded-xl shadow-2xl shadow-black/50">
        <div className="flex flex-col sm:flex-row">
          {/* Product preview image — desktop only */}
          <div className="hidden sm:block relative sm:w-[45%] sm:shrink-0 overflow-hidden">
            <div className="aspect-[4/3] sm:aspect-auto sm:min-h-[280px] sm:h-full relative">
              <img src={product.thumbnail} alt={product.name} className="w-full h-full object-cover sm:rounded-l-xl" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent sm:bg-gradient-to-r sm:from-transparent sm:via-black/10 sm:to-black/60" />
              <div className="absolute bottom-3 left-3 right-3">
                <Badge className="bg-[#06B6D4]/30 text-[#06B6D4] border-[#06B6D4]/30 text-[10px] px-2 py-0.5">Airtime / Data</Badge>
                <h3 className="text-white font-bold text-sm mt-1">{product.name}</h3>
              </div>
            </div>
          </div>

          {/* Mobile header */}
          <div className="sm:hidden px-3 pt-3 pb-0">
            <Badge className="bg-[#06B6D4]/30 text-[#06B6D4] border-[#06B6D4]/30 text-[10px] px-2 py-0.5">Airtime / Data</Badge>
            <h3 className="text-white font-bold text-sm mt-1">{product.name}</h3>
          </div>

          {/* Form */}
          <div className="p-3 sm:p-4 space-y-3 sm:w-[55%]">
            <DialogHeader className="text-left space-y-0">
              <DialogTitle className="text-base font-bold sr-only">Top Up</DialogTitle>
              <DialogDescription className="sr-only">Enter your phone number and amount to purchase airtime or data</DialogDescription>
            </DialogHeader>

            {/* ── Payment token selector ──────────────────────────────── */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Pay with</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(["VERSE", "USDT_POLYGON", "SOL", "ECASH"] as PaymentToken[]).map((token) => (
                  <button
                    key={token}
                    type="button"
                    disabled={isBusy}
                    onClick={() => !isBusy && setPaymentToken(token)}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-semibold transition-all border cursor-pointer disabled:opacity-50 ${
                      paymentToken === token
                        ? "bg-[#06B6D4]/15 border-[#06B6D4]/40 text-[#06B6D4]"
                        : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20"
                    }`}
                    style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                  >
                    <span className="text-[11px] font-bold">{TOKEN_SYMBOLS[token]}</span>
                    {token === "USDT_POLYGON" && <span className="text-[8px] opacity-60">Polygon</span>}
                    {token === "SOL" && <span className="text-[8px] opacity-60">Solana</span>}
                    {token === "ECASH" && <span className="text-[8px] opacity-60">XEC</span>}
                    {token === "VERSE" && <span className="text-[8px] opacity-60">Polygon</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Wallet / QR section ─────────────────────────────────── */}
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 space-y-2">
              {renderWalletSection()}
            </div>

            {/* ── Tx status banner ─────────────────────────────────────── */}
            {isBusy && (
              <div className="rounded-lg border border-[#06B6D4]/20 bg-[#06B6D4]/10 px-3 py-2.5 space-y-1">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 text-[#06B6D4] animate-spin shrink-0" />
                  <span className="text-[11px] font-medium text-[#06B6D4]">
                    {txStatus === "sending" && "Submitting transaction…"}
                    {txStatus === "confirming" && "Waiting for on-chain confirmation…"}
                    {txStatus === "verifying" && "Verifying transaction & sending notification…"}
                  </span>
                </div>
                {txHash && (
                  <a href={EXPLORER_FOR_TOKEN[paymentToken](txHash)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-[#06B6D4]/80 hover:text-[#06B6D4]">
                    View on explorer <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
            )}
            {isCompleted && (
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2.5 space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#06B6D4] shrink-0" />
                  <span className="text-[11px] font-medium text-[#06B6D4]">Purchase confirmed!</span>
                </div>
                {confirmResult && (
                  <a href={confirmResult.explorerUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-[#06B6D4]/80 hover:text-[#06B6D4]">
                    View on explorer <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
                {confirmResult && !confirmResult.emailSent && (
                  <p className="text-[10px] text-amber-400/80">Notification email could not be sent.</p>
                )}
              </div>
            )}
            {isFailed && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 space-y-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  <span className="text-[11px] font-medium text-red-400">Transaction failed</span>
                </div>
                {txError && <p className="text-[10px] text-red-400/80">{txError}</p>}
              </div>
            )}

            {/* ── Airtime / Data toggle ────────────────────────────────── */}
            <div className="flex gap-2">
              {(["airtime", "data"] as PurchaseType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => !isBusy && setPurchaseType(type)}
                  disabled={isBusy}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all border cursor-pointer disabled:opacity-50 ${
                    purchaseType === type
                      ? "bg-[#06B6D4]/15 border-[#06B6D4]/40 text-[#06B6D4]"
                      : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
                  }`}
                  style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
                >
                  {type === "airtime" ? <Smartphone className="h-3.5 w-3.5" /> : <Signal className="h-3.5 w-3.5" />}
                  {type === "airtime" ? "Airtime" : "Data"}
                </button>
              ))}
            </div>

            {/* ── Phone number ─────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Phone Number</label>
              <Input
                type="tel"
                placeholder="08012345678"
                value={phoneNumber}
                onChange={(e) => !isBusy && setPhoneNumber(e.target.value.replace(/[^0-9]/g, ""))}
                maxLength={11}
                disabled={isBusy}
                className="h-10 bg-white/5 border-white/10 text-sm focus-visible:ring-[#06B6D4]/50"
              />
            </div>

            {/* ── Data plan dropdown ───────────────────────────────────── */}
            {purchaseType === "data" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Data Plan</label>
                <div className="rounded-lg border border-white/15 overflow-hidden" style={{ background: "hsl(240,10%,11%)" }}>
                  <button
                    type="button"
                    disabled={isBusy}
                    className="w-full flex items-center justify-between px-3 h-10 text-sm text-left disabled:opacity-50"
                    style={{ background: "hsl(240,10%,11%)" }}
                    onClick={() => { if (!isBusy) { if (selectedPlan) { setSelectedPlanId(""); setIsPlanOpen(true); } else { setIsPlanOpen((o) => !o); } } }}
                  >
                    <span className={selectedPlan ? "text-foreground" : "text-muted-foreground"}>
                      {selectedPlan ? selectedPlan.label : "Choose a data plan"}
                    </span>
                    <ChevronDown className={`h-4 w-4 opacity-50 shrink-0 ml-2 transition-transform ${isPlanOpen && !selectedPlan ? "rotate-180" : ""}`} />
                  </button>
                  {isPlanOpen && !selectedPlan && (
                    <div className="border-t border-white/10 max-h-[220px] overflow-y-auto overscroll-contain" style={{ background: "hsl(240,10%,9%)" }}>
                      {(["daily", "weekly", "monthly"] as DataPlanCategory[])
                        .filter((cat) => dataPlans.some((p) => p.category === cat))
                        .map((cat) => (
                          <div key={cat}>
                            <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide sticky top-0" style={{ background: "hsl(240,10%,7%)" }}>
                              {CATEGORY_LABELS[cat]}
                            </div>
                            {dataPlans.filter((p) => p.category === cat).map((plan) => (
                              <button
                                key={plan.id}
                                type="button"
                                disabled={isBusy}
                                onClick={() => { if (!isBusy) { setSelectedPlanId(plan.id); setIsPlanOpen(false); } }}
                                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#06B6D4]/10 transition-colors border-b border-white/5 last:border-0 disabled:opacity-50"
                                style={{ background: "hsl(240,10%,9%)" }}
                              >
                                <div className="flex flex-col leading-tight min-w-0">
                                  <span className="text-xs font-medium">{plan.label}</span>
                                  <span className="text-[10px] text-muted-foreground">{plan.dataValue} · {plan.validity}</span>
                                </div>
                                <span className="text-xs font-semibold text-[#06B6D4] shrink-0 ml-3">₦{plan.price.toLocaleString()}</span>
                              </button>
                            ))}
                          </div>
                        ))}
                    </div>
                  )}
                  {selectedPlan && (
                    <div className="border-t border-white/10 px-3 py-2 flex items-center justify-between bg-[#06B6D4]/10">
                      <div className="flex flex-col leading-tight min-w-0">
                        <span className="text-[10px] text-[#06B6D4]/80">Selected</span>
                        <span className="text-xs font-semibold text-[#06B6D4]">{selectedPlan.dataValue} · {selectedPlan.validity}</span>
                      </div>
                      <button
                        type="button" disabled={isBusy}
                        onClick={() => !isBusy && setSelectedPlanId("")}
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-3 disabled:opacity-50"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Data value display ───────────────────────────────────── */}
            {purchaseType === "data" && selectedPlan && (
              <div className="flex items-center gap-3 rounded-lg bg-[#06B6D4]/10 border border-[#06B6D4]/20 px-3 py-2.5">
                <div className="h-8 w-8 rounded-lg bg-[#06B6D4]/20 flex items-center justify-center shrink-0">
                  <Database className="h-4 w-4 text-[#06B6D4]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#06B6D4]/80">Data value</p>
                  <p className="text-sm font-bold text-[#06B6D4]">{selectedPlan.dataValue}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-muted-foreground">Valid for</p>
                  <p className="text-xs font-semibold text-white">{selectedPlan.validity}</p>
                </div>
              </div>
            )}

            {/* ── Amount input ─────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {purchaseType === "data" && selectedPlan ? "Price (₦)" : "Amount (₦)"}
              </label>
              <Input
                type="number"
                placeholder={purchaseType === "data" ? "Select a plan" : "1000"}
                value={amount}
                onChange={(e) => { if (!isBusy && purchaseType === "airtime") setAmount(e.target.value); }}
                readOnly={(purchaseType === "data" && !!selectedPlan) || isBusy}
                min={100}
                disabled={isBusy}
                className={`h-10 bg-white/5 border-white/10 text-sm focus-visible:ring-[#06B6D4]/50 ${purchaseType === "data" && selectedPlan ? "opacity-70 cursor-default" : ""}`}
              />
              {purchaseType === "airtime" && <p className="text-[10px] text-muted-foreground">Min: ₦100</p>}
            </div>

            {/* ── Rate info box ─────────────────────────────────────────── */}
            <div className="rounded-lg bg-[#06B6D4]/10 border border-[#06B6D4]/20 px-3 py-2 space-y-1">
              <div className="flex items-center gap-2">
                <Wallet className="h-3.5 w-3.5 text-[#06B6D4] shrink-0" />
                <div className="flex-1 min-w-0">
                  {nairaAmount > 0 ? (
                    <>
                      <p className="text-[10px] text-[#06B6D4]/80">You will pay</p>
                      <p className="text-xs font-bold text-[#06B6D4]">
                        {rateLoading
                          ? <span className="inline-flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" />Calculating…</span>
                          : `${tokenAmount.toLocaleString(undefined, { maximumFractionDigits: paymentToken === "ECASH" ? 2 : paymentToken === "SOL" ? 6 : 4 })} ${tokenSymbol}`}
                      </p>
                    </>
                  ) : (
                    <p className="text-[10px] text-[#06B6D4]/80">
                      {purchaseType === "data" ? "Select a plan to see cost" : `Enter an amount to see ${TOKEN_LABELS[paymentToken]} cost`}
                    </p>
                  )}
                </div>
                <Badge className="bg-cyan-500/15 text-[#06B6D4] border-cyan-500/20 text-[9px] px-1.5 py-0 leading-4 h-4 shrink-0">LIVE</Badge>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {rateLoading
                  ? <span className="inline-flex items-center gap-1"><RefreshCw className="h-2.5 w-2.5 animate-spin" />Fetching live rate…</span>
                  : rateError
                  ? <span className="text-amber-400/80">Using fallback rate (live rate unavailable)</span>
                  : <span>
                      1 ₦ ≈ {currentRate.toFixed(paymentToken === "SOL" ? 8 : paymentToken === "USDT_POLYGON" ? 6 : 4)} {tokenSymbol}
                      {nairaAmount > 0 && <span className="text-[#06B6D4]/60 ml-1">(incl. {feePercent}% fee)</span>}
                    </span>}
              </div>
            </div>

            {/* ── Spend / Confirm button ───────────────────────────────── */}
            <div className="space-y-1.5">
              {renderSpendButton()}
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Finalize modal — QR flow (mobile or ECASH) */}
      <FinalizeModal
        open={showFinalize}
        onClose={() => {
          setShowFinalize(false);
          if (txStatus === "completed" || txStatus === "failed") onClose();
        }}
        product={product}
        details={{
          purchaseType,
          phoneNumber,
          nairaAmount: parseFloat(amount) || 0,
          tokenAmount: tokenAmount.toLocaleString(undefined, {
            maximumFractionDigits: paymentToken === "ECASH" ? 2 : paymentToken === "SOL" ? 9 : 18,
            useGrouping: false,
          }),
          tokenSymbol,
          dataPlan: selectedPlan?.label,
          currency: product?.currency ?? "₦",
        }}
        onConfirm={handleFinalizeConfirm}
        isSubmitting={isConfirmingBackend}
        isCompleted={isCompleted}
        isFailed={isFailed}
        error={confirmError ?? null}
        paymentToken={paymentToken}
      />
    </Dialog>
  );
}
