import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Star, MessageSquare, Loader2 } from "lucide-react";

interface Review {
  id: string;
  name: string;
  rating: number;
  message: string;
  createdAt: string;
}

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

export default function Reviews() {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/reviews")
      .then((r) => r.json())
      .then((data: Review[]) => setReviews(data))
      .catch(() => {
        toast({ title: "Could not load reviews", variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (rating === 0) {
      toast({ title: "Please select a star rating", variant: "destructive" });
      return;
    }
    if (!message.trim()) {
      toast({ title: "Message is required", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), rating, message: message.trim() }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        toast({ title: err.error ?? "Submission failed", variant: "destructive" });
        return;
      }

      const newReview = (await res.json()) as Review;
      setReviews((prev) => [newReview, ...prev]);
      setName("");
      setRating(0);
      setMessage("");
      toast({ title: "Review submitted — thank you!" });
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "2rem 1rem 4rem" }}>
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="h-5 w-5 text-[#06B6D4]" />
            <h1 className="text-2xl font-bold text-white">Reviews & Feedback</h1>
          </div>
          <p className="text-white/50 text-sm">
            Share your experience with the community.
          </p>
        </div>

        {/* Submission form */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: "rgba(6,182,212,0.06)",
            border: "1px solid rgba(6,182,212,0.2)",
            borderRadius: 14,
            padding: "1.5rem",
            marginBottom: "2.5rem",
          }}
        >
          <h2 className="text-base font-semibold text-white mb-4">Leave a Review</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">
                Your Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Chidi Okonkwo"
                maxLength={100}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#fff",
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">
                Rating
              </label>
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
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#fff",
                  resize: "vertical",
                }}
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#06B6D4] text-black font-semibold hover:bg-[#0891B2] border-0"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit Review"
              )}
            </Button>
          </div>
        </form>

        {/* Reviews list */}
        <div>
          <h2 className="text-base font-semibold text-white mb-4">
            Community Reviews
            {!loading && reviews.length > 0 && (
              <span className="text-white/40 font-normal text-sm ml-2">
                ({reviews.length})
              </span>
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
