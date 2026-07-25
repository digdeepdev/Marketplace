import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Star, MessageSquare, Loader2, Mail, ShieldCheck, ArrowLeft } from "lucide-react";
import { useSeo } from "@/lib/seo";
import { SITE_ORIGIN } from "@/lib/airtime-products";

interface Review {
  id: string;
  name: string;
  rating: number;
  message: string;
  createdAt: string;
}

// ── Star rating ───────────────────────────────────────────────────────────────
function StarRating({
  value,
  onChange,
  readonly,
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={`text-2xl leading-none transition-colors ${readonly ? "cursor-default" : "cursor-pointer"}`}
          aria-label={`${star} star${star !== 1 ? "s" : ""}`}
        >
          <Star
            className={`h-6 w-6 transition-colors ${
              star <= (hovered || value)
                ? "fill-yellow-400 text-yellow-400"
                : "fill-transparent text-white/20"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ── Review card ───────────────────────────────────────────────────────────────
function ReviewCard({ review }: { review: Review }) {
  const date = new Date(review.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: "1rem 1.25rem",
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-semibold text-white leading-tight">{review.name}</p>
          <p className="text-xs text-white/40 mt-0.5">{date}</p>
        </div>
        <StarRating value={review.rating} readonly />
      </div>
      <p className="text-sm text-white/70 leading-relaxed">{review.message}</p>
    </div>
  );
}

// ── Card wrapper shared across steps ─────────────────────────────────────────
function FormCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(6,182,212,0.06)",
        border: "1px solid rgba(6,182,212,0.2)",
        borderRadius: 14,
        padding: "1.5rem",
        marginBottom: "2.5rem",
      }}
    >
      {children}
    </div>
  );
}

type Step = "email" | "otp" | "review";

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Reviews() {
  useSeo({
    title: "Customer Reviews | Subrefill",
    description: "Read verified customer reviews of Subrefill — buy airtime and data with crypto.",
    canonicalUrl: `${SITE_ORIGIN}/reviews`,
  });
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  // Auth state
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [reviewToken, setReviewToken] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [cooldown, setCooldown] = useState(0); // seconds until resend allowed
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Review form state
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/reviews")
      .then((r) => r.json())
      .then((data: Review[]) => setReviews(data))
      .catch(() => toast({ title: "Could not load reviews", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  // Cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // ── Step 1: send OTP ────────────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast({ title: "Please enter your email", variant: "destructive" }); return; }
    setSendingOtp(true);
    try {
      const res = await fetch("/api/reviews/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json()) as { sent?: boolean; error?: string };
      if (!res.ok) {
        toast({ title: data.error ?? "Failed to send code", variant: "destructive" });
        if (res.status === 429) setCooldown(60);
        return;
      }
      setCooldown(60);
      setStep("otp");
      toast({ title: "Code sent! Check your inbox." });
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setSendingOtp(false);
    }
  };

  // ── Step 2: verify OTP ──────────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.trim().length !== 6) { toast({ title: "Enter the 6-digit code", variant: "destructive" }); return; }
    setVerifyingOtp(true);
    try {
      const res = await fetch("/api/reviews/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: otp.trim() }),
      });
      const data = (await res.json()) as { token?: string; email?: string; error?: string };
      if (!res.ok) {
        toast({ title: data.error ?? "Verification failed", variant: "destructive" });
        return;
      }
      setReviewToken(data.token!);
      setVerifiedEmail(data.email!);
      setStep("review");
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = () => {
    setOtp("");
    setStep("email");
  };

  // ── Step 3: submit review ───────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    if (rating === 0) { toast({ title: "Please select a star rating", variant: "destructive" }); return; }
    if (!message.trim()) { toast({ title: "Message is required", variant: "destructive" }); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), rating, message: message.trim(), reviewToken }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        if (res.status === 401) {
          toast({ title: "Session expired — please verify your email again", variant: "destructive" });
          setReviewToken("");
          setStep("email");
          return;
        }
        toast({ title: err.error ?? "Submission failed", variant: "destructive" });
        return;
      }

      const newReview = (await res.json()) as Review;
      setReviews((prev) => [newReview, ...prev]);
      setName("");
      setRating(0);
      setMessage("");
      setReviewToken("");
      setVerifiedEmail("");
      setStep("email");
      setEmail("");
      toast({ title: "Review submitted — thank you!" });
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render form section ─────────────────────────────────────────────────────
  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#fff",
  } as React.CSSProperties;

  const formSection = () => {
    if (step === "email") {
      return (
        <FormCard>
          <div className="flex items-center gap-2 mb-4">
            <Mail className="h-4 w-4 text-[#06B6D4]" />
            <h2 className="text-base font-semibold text-white">Verify your email to leave a review</h2>
          </div>
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">Email address</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={sendingOtp || cooldown > 0}
              className="w-full bg-[#06B6D4] text-black font-semibold hover:bg-[#0891B2] border-0"
            >
              {sendingOtp ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</>
              ) : cooldown > 0 ? (
                `Resend in ${cooldown}s`
              ) : (
                "Send Verification Code"
              )}
            </Button>
          </form>
        </FormCard>
      );
    }

    if (step === "otp") {
      return (
        <FormCard>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-[#06B6D4]" />
            <h2 className="text-base font-semibold text-white">Enter verification code</h2>
          </div>
          <p className="text-xs text-white/50 mb-4">
            We sent a 6-digit code to <span className="text-white/80">{email}</span>
          </p>
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">6-digit code</label>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                maxLength={6}
                style={{ ...inputStyle, letterSpacing: "0.3em", fontSize: "1.25rem", textAlign: "center" }}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={verifyingOtp || otp.length !== 6}
              className="w-full bg-[#06B6D4] text-black font-semibold hover:bg-[#0891B2] border-0"
            >
              {verifyingOtp ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying…</>
              ) : (
                "Verify Code"
              )}
            </Button>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleResendOtp}
                className="text-white/40 hover:text-white/70 transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Change email
              </button>
              <button
                type="button"
                onClick={() => { setOtp(""); void handleSendOtp(new Event("submit") as unknown as React.FormEvent); }}
                disabled={cooldown > 0 || sendingOtp}
                className="text-[#06B6D4]/70 hover:text-[#06B6D4] transition-colors disabled:opacity-40"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          </form>
        </FormCard>
      );
    }

    // step === "review"
    return (
      <FormCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Leave a Review</h2>
          <span className="text-xs text-[#06B6D4] bg-[#06B6D4]/10 px-2 py-0.5 rounded-full">
            ✓ {verifiedEmail}
          </span>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">Your Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chidi Okonkwo"
              maxLength={100}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">Rating</label>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              Message
              <span className="text-white/30 font-normal ml-1">({message.length}/500)</span>
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 500))}
              placeholder="Tell us about your experience..."
              rows={4}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#06B6D4] text-black font-semibold hover:bg-[#0891B2] border-0"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</>
            ) : (
              "Submit Review"
            )}
          </Button>
        </form>
      </FormCard>
    );
  };

  return (
    <Layout>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "2rem 1rem 4rem" }}>
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="h-5 w-5 text-[#06B6D4]" />
            <h1 className="text-2xl font-bold text-white">Reviews & Feedback</h1>
          </div>
          <p className="text-white/50 text-sm">Share your experience with the community.</p>
        </div>

        {formSection()}

        <div>
          <h2 className="text-base font-semibold text-white mb-4">
            Community Reviews
            {!loading && reviews.length > 0 && (
              <span className="text-white/40 font-normal text-sm ml-2">({reviews.length})</span>
            )}
          </h2>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-white/30" />
            </div>
          ) : reviews.length === 0 ? (
            <div
              className="text-center py-14"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed rgba(255,255,255,0.1)",
                borderRadius: 12,
              }}
            >
              <MessageSquare className="h-8 w-8 text-white/20 mx-auto mb-3" />
              <p className="text-white/40 text-sm">Be the first to leave a review!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
