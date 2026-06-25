import { useState, useEffect, useCallback } from "react";
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
import { Loader2, CheckCircle2, AlertTriangle, Smartphone, Database, Wallet } from "lucide-react";
import type { Product } from "./product-card";

interface FinalizeDetails {
  purchaseType: string;
  phoneNumber: string;
  nairaAmount: number;
  verseAmount: string;
  dataPlan?: string;
  currency: string;
}

interface FinalizeModalProps {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  details: FinalizeDetails;
  onConfirm: (txHash: string) => void;
  isSubmitting: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  error?: string | null;
}

export function FinalizeModal({
  open,
  onClose,
  product,
  details,
  onConfirm,
  isSubmitting,
  isCompleted,
  isFailed,
  error,
}: FinalizeModalProps) {
  const [txHash, setTxHash] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(180);
  const [timerActive, setTimerActive] = useState(false);

  const resetTimer = useCallback(() => {
    setTimerSeconds(180);
    setTimerActive(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetTimer();
      setTxHash("");
    }
  }, [open, resetTimer]);

  useEffect(() => {
    if (isSubmitting && !timerActive) {
      setTimerActive(true);
      setTimerSeconds(180);
    }
  }, [isSubmitting, timerActive]);

  useEffect(() => {
    if (!timerActive) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive]);

  const progress = ((180 - timerSeconds) / 180) * 100;
  const isFormValid = txHash.trim().startsWith("0x");
  const isBusy = isSubmitting || timerActive;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-[95vw] sm:max-w-[420px] border-white/5 bg-card/95 backdrop-blur-xl p-0 overflow-hidden !rounded-xl shadow-2xl shadow-black/50">
        <div className="p-4 sm:p-5 space-y-4">
          <DialogHeader className="text-left space-y-0">
            <DialogTitle className="text-base font-bold">Finalize Purchase</DialogTitle>
            <DialogDescription className="sr-only">
              Enter your transaction hash to finalize the purchase
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#136FD3]/30 text-[#136FD3] border-[#136FD3]/30 text-[10px] px-2 py-0.5">
                {details.purchaseType === "airtime" ? "Airtime" : "Data"}
              </Badge>
              {details.dataPlan && (
                <span className="text-[10px] text-muted-foreground">{details.dataPlan}</span>
              )}
            </div>
            <h3 className="text-white font-bold text-sm">{product?.name ?? "N/A"}</h3>
            <div className="space-y-1 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Smartphone className="h-3 w-3 text-[#136FD3] shrink-0" />
                <span>{details.phoneNumber}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Wallet className="h-3 w-3 text-[#136FD3] shrink-0" />
                <span>{details.currency}{details.nairaAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Database className="h-3 w-3 text-[#136FD3] shrink-0" />
                <span>{details.verseAmount} Verse</span>
              </div>
            </div>
          </div>

          {!isBusy && !isCompleted && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Transaction Hash</label>
              <Input
                placeholder="0x…"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                disabled={isBusy}
                className="h-10 bg-white/5 border-white/10 text-sm focus-visible:ring-[#136FD3]/50 font-mono text-[11px]"
              />
              <p className="text-[10px] text-muted-foreground">
                Paste the Polygon transaction hash after sending payment
              </p>
            </div>
          )}

          {isBusy && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-[#136FD3]" />
                  Finalizing purchase…
                </span>
                <span>{Math.ceil(timerSeconds / 60)}m {timerSeconds % 60}s</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#136FD3] transition-all duration-1000 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                Please do not close this window. Verifying your transaction and notifying the team.
              </p>
            </div>
          )}

          {isCompleted && (
            <div className="text-center space-y-2 py-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
              <p className="text-sm font-semibold text-white">Purchase Submitted</p>
              <p className="text-[11px] text-muted-foreground">
                Your transaction has been verified and the team has been notified.
              </p>
            </div>
          )}

          {isFailed && (
            <div className="text-center space-y-2 py-2">
              <AlertTriangle className="h-8 w-8 text-red-400 mx-auto" />
              <p className="text-sm font-semibold text-white">Verification Failed</p>
              <p className="text-[11px] text-red-400/80">
                {error ?? "Could not verify transaction. Please check the hash and try again."}
              </p>
            </div>
          )}

          {!isCompleted && (
            <Button
              className="w-full bg-[#136FD3] text-white border-0 font-semibold h-11 hover:bg-[#1060ba]"
              disabled={isBusy || !isFormValid}
              onClick={() => {
                const trimmed = txHash.trim();
                if (!trimmed.startsWith("0x")) return;
                onConfirm(trimmed);
              }}
            >
              {isBusy ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Processing…</>
              ) : (
                <>Finalize</>
              )}
            </Button>
          )}

          {isCompleted && (
            <Button
              className="w-full bg-[#136FD3] text-white border-0 font-semibold h-11 hover:bg-[#1060ba]"
              onClick={onClose}
            >
              Done
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
