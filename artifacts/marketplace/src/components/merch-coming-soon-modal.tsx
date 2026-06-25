import { Dialog, DialogContent } from "./ui/dialog";

interface MerchComingSoonModalProps {
  open: boolean;
  onClose: () => void;
}

export function MerchComingSoonModal({ open, onClose }: MerchComingSoonModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm border-white/10 bg-[#0d0d1a] p-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_top,rgba(217,11,251,0.18)_0%,transparent_70%)] pointer-events-none" />

        <div className="relative flex flex-col items-center px-8 pt-10 pb-8 text-center">
          <svg
            width="160"
            height="130"
            viewBox="0 0 160 130"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="mb-6"
          >
            <rect x="10" y="30" width="140" height="5" rx="2.5" fill="#D90BFB" opacity="0.7" />
            <rect x="12" y="35" width="4" height="70" rx="2" fill="#D90BFB" opacity="0.5" />
            <rect x="144" y="35" width="4" height="70" rx="2" fill="#D90BFB" opacity="0.5" />
            <rect x="6" y="102" width="16" height="4" rx="2" fill="#D90BFB" opacity="0.4" />
            <rect x="138" y="102" width="16" height="4" rx="2" fill="#D90BFB" opacity="0.4" />
            <rect x="78" y="0" width="4" height="32" rx="2" fill="#D90BFB" opacity="0.5" />
            <path d="M80 0 Q80 -4 84 -4" stroke="#D90BFB" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
            <g transform="translate(28, 30)">
              <path d="M10 0 Q10 -6 16 -6 Q22 -6 22 0" stroke="#a78bfa" strokeWidth="2" fill="none" strokeLinecap="round" />
              <rect x="4" y="0" width="24" height="28" rx="3" fill="#136FD3" opacity="0.85" />
              <path d="M12 0 Q16 6 20 0" stroke="#0a3a7a" strokeWidth="1.5" fill="none" />
              <path d="M4 0 L0 10 L5 12 L7 4" fill="#136FD3" opacity="0.85" />
              <path d="M28 0 L32 10 L27 12 L25 4" fill="#136FD3" opacity="0.85" />
              <text x="16" y="20" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white" opacity="0.7">V</text>
            </g>
            <g transform="translate(64, 30)">
              <path d="M16 0 Q16 -6 22 -6 Q28 -6 28 0" stroke="#a78bfa" strokeWidth="2" fill="none" strokeLinecap="round" />
              <rect x="6" y="0" width="28" height="32" rx="4" fill="#D90BFB" opacity="0.8" />
              <path d="M10 0 Q20 -8 30 0" fill="#D90BFB" opacity="0.9" />
              <path d="M13 0 Q20 -4 27 0" fill="#0d0d1a" opacity="0.6" />
              <path d="M6 2 L0 14 L6 16 L8 6" fill="#D90BFB" opacity="0.8" />
              <path d="M34 2 L40 14 L34 16 L32 6" fill="#D90BFB" opacity="0.8" />
              <rect x="14" y="18" width="12" height="8" rx="2" fill="#b008d4" opacity="0.7" />
            </g>
            <g transform="translate(104, 30)">
              <path d="M10 0 Q10 -6 16 -6 Q22 -6 22 0" stroke="#a78bfa" strokeWidth="2" fill="none" strokeLinecap="round" />
              <rect x="4" y="0" width="24" height="28" rx="3" fill="#6366f1" opacity="0.85" />
              <path d="M12 0 Q16 6 20 0" stroke="#2d2e8f" strokeWidth="1.5" fill="none" />
              <path d="M4 0 L0 10 L5 12 L7 4" fill="#6366f1" opacity="0.85" />
              <path d="M28 0 L32 10 L27 12 L25 4" fill="#6366f1" opacity="0.85" />
              <text x="16" y="20" textAnchor="middle" fontSize="8" fontWeight="bold" fill="white" opacity="0.6">BCH</text>
            </g>
            <circle cx="20" cy="15" r="2" fill="#D90BFB" opacity="0.6" />
            <circle cx="140" cy="18" r="1.5" fill="#136FD3" opacity="0.7" />
            <circle cx="80" cy="118" r="1.5" fill="#D90BFB" opacity="0.4" />
            <path d="M148 10 L149 14 L152 15 L149 16 L148 20 L147 16 L144 15 L147 14 Z" fill="#D90BFB" opacity="0.5" />
            <path d="M8 80 L9 83 L11 84 L9 85 L8 88 L7 85 L5 84 L7 83 Z" fill="#136FD3" opacity="0.5" />
          </svg>

          <h2 className="text-xl font-extrabold text-white mb-1 tracking-tight">
            Merch Drop{" "}
            <span className="text-transparent bg-clip-text bg-[linear-gradient(90deg,#D90BFB,#136FD3)]">
              Coming Soon
            </span>
          </h2>
          <p className="text-sm text-white/50 leading-relaxed max-w-xs mb-6">
            We're stitching together something special for the Verse community. Stay tuned for the official drop.
          </p>

          <div className="flex items-center gap-2 rounded-full border border-[#D90BFB]/30 bg-[#D90BFB]/10 px-4 py-1.5 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D90BFB] animate-pulse" />
            <span className="text-xs font-medium text-[#D90BFB]">Launching Q4 2026</span>
          </div>

          <button
            onClick={onClose}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white transition-all"
          >
            Got it
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
