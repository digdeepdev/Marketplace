import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { logger } from "../lib/logger";
import nodemailer from "nodemailer";

const router: IRouter = Router();

const REVIEWS_FILE = path.resolve(process.env.REVIEWS_FILE ?? "./data/reviews.json");

const ReviewSchema = z.object({
  id: z.string(),
  name: z.string(),
  rating: z.number().int().min(1).max(5),
  message: z.string(),
  createdAt: z.string(),
  email: z.string().optional(),
});

export type Review = z.infer<typeof ReviewSchema>;

const PostReviewBody = z.object({
  name: z.string().min(1, "Name is required").max(100),
  rating: z.number().int().min(1).max(5),
  message: z.string().min(1, "Message is required").max(500),
  reviewToken: z.string().min(1, "Email verification required"),
});

function readReviews(): Review[] {
  try {
    const dir = path.dirname(REVIEWS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(REVIEWS_FILE)) return [];
    const raw = fs.readFileSync(REVIEWS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Review => ReviewSchema.safeParse(item).success);
  } catch (err) {
    logger.warn({ err }, "reviews: failed to read reviews file, returning empty list");
    return [];
  }
}

function writeReviews(reviews: Review[]): void {
  const dir = path.dirname(REVIEWS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2), "utf-8");
}

// ── OTP & token stores (in-memory, no DB needed) ─────────────────────────────
interface OtpEntry { code: string; expiresAt: number; attempts: number; sentAt: number }
interface TokenEntry { email: string; expiresAt: number }

const otpStore = new Map<string, OtpEntry>();   // key: normalised email
const tokenStore = new Map<string, TokenEntry>(); // key: random hex token

const OTP_TTL_MS = 10 * 60 * 1000;    // 10 minutes
const TOKEN_TTL_MS = 60 * 60 * 1000;  // 1 hour
const MIN_RESEND_MS = 60 * 1000;       // can't re-request code within 60 s
const MAX_ATTEMPTS = 5;                // wrong-code attempts before OTP is voided

function generateOtp(): string {
  return String(crypto.randomInt(100_000, 999_999));
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function cleanupExpired(): void {
  const now = Date.now();
  for (const [k, v] of otpStore) if (v.expiresAt < now) otpStore.delete(k);
  for (const [k, v] of tokenStore) if (v.expiresAt < now) tokenStore.delete(k);
}

export function validateReviewToken(token: string): string | null {
  cleanupExpired();
  const entry = tokenStore.get(token);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.email;
}

// ── Email helpers ─────────────────────────────────────────────────────────────
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL ?? "digdeepeth@gmail.com";
const FROM_EMAIL = process.env.FROM_EMAIL ?? "onboarding@resend.dev";

function makeTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: { rejectUnauthorized: false },
  });
}

async function sendEmail(to: string, subject: string, html: string, log?: import("pino").Logger): Promise<{ ok: boolean; error?: string }> {
  const transporter = makeTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({ from: `"Subrefill" <${SMTP_USER}>`, to, subject, html });
      return { ok: true };
    } catch (err) {
      log?.warn({ err }, "email: SMTP failed; falling back to Resend");
    }
  }
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    log?.warn("email: no SMTP or RESEND_API_KEY configured");
    return { ok: false, error: "Email service not configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: `Subrefill <${FROM_EMAIL}>`, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log?.warn({ status: res.status, body }, "email: Resend returned non-OK");
      return { ok: false, error: `Email delivery failed (status ${res.status})` };
    }
    return { ok: true };
  } catch (err) {
    log?.warn({ err }, "email: Resend request failed");
    return { ok: false, error: "Email delivery failed" };
  }
}

function otpEmailHtml(code: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
    <h2 style="color:#06B6D4">Your Subrefill verification code</h2>
    <p style="font-size:15px;color:#333">Use the code below to verify your email and leave a review. It expires in <strong>10 minutes</strong>.</p>
    <div style="font-size:36px;font-weight:700;letter-spacing:8px;text-align:center;padding:24px;background:#f5f5f5;border-radius:8px;color:#111;margin:20px 0">${code}</div>
    <p style="font-size:12px;color:#999">If you didn't request this, you can ignore this email.</p>
  </div>`;
}

function buildReviewEmailHtml(review: Review): string {
  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
  return `<div style="font-family:Arial,sans-serif;max-width:600px">
    <h2 style="color:#136FD3">⭐ New Review Submitted</h2>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Name</strong></td><td style="padding:8px;border:1px solid #ddd">${review.name}</td></tr>
      ${review.email ? `<tr><td style="padding:8px;border:1px solid #ddd"><strong>Email</strong></td><td style="padding:8px;border:1px solid #ddd">${review.email}</td></tr>` : ""}
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Rating</strong></td><td style="padding:8px;border:1px solid #ddd">${stars} (${review.rating}/5)</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Message</strong></td><td style="padding:8px;border:1px solid #ddd">${review.message}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Date</strong></td><td style="padding:8px;border:1px solid #ddd">${new Date(review.createdAt).toLocaleString()}</td></tr>
    </table>
  </div>`;
}

// ── OTP routes ────────────────────────────────────────────────────────────────
router.post("/reviews/otp/send", async (req: Request, res: Response): Promise<void> => {
  const body = z.object({ email: z.string().email("Valid email required") }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid email" }); return; }

  const email = body.data.email.toLowerCase().trim();
  cleanupExpired();

  const existing = otpStore.get(email);
  if (existing && Date.now() - existing.sentAt < MIN_RESEND_MS) {
    const waitSec = Math.ceil((MIN_RESEND_MS - (Date.now() - existing.sentAt)) / 1000);
    res.status(429).json({ error: `Please wait ${waitSec}s before requesting another code.` });
    return;
  }

  const code = generateOtp();
  otpStore.set(email, { code, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0, sentAt: Date.now() });

  const result = await sendEmail(email, "Your Subrefill verification code", otpEmailHtml(code), req.log);
  if (!result.ok) {
    // Remove the OTP so they can retry cleanly
    otpStore.delete(email);
    req.log.warn({ email, error: result.error }, "OTP email failed to send");
    res.status(500).json({ error: "Failed to send verification code. Please try again shortly." });
    return;
  }
  req.log.info({ email }, "OTP sent for review verification");
  res.json({ sent: true });
});

router.post("/reviews/otp/verify", (req: Request, res: Response): void => {
  const body = z.object({
    email: z.string().email(),
    code: z.string().length(6, "Code must be 6 digits"),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid request" }); return; }

  const email = body.data.email.toLowerCase().trim();
  cleanupExpired();

  const entry = otpStore.get(email);
  if (!entry || entry.expiresAt < Date.now()) {
    res.status(400).json({ error: "Code expired or not found. Please request a new one." });
    return;
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(email);
    res.status(400).json({ error: "Too many wrong attempts. Please request a new code." });
    return;
  }
  if (entry.code !== body.data.code.trim()) {
    entry.attempts += 1;
    const left = MAX_ATTEMPTS - entry.attempts;
    res.status(400).json({ error: `Incorrect code. ${left} attempt${left !== 1 ? "s" : ""} remaining.` });
    return;
  }

  otpStore.delete(email);
  const token = generateToken();
  tokenStore.set(token, { email, expiresAt: Date.now() + TOKEN_TTL_MS });
  req.log.info({ email }, "OTP verified — review token issued");
  res.json({ token, email });
});

// ── Admin delete ──────────────────────────────────────────────────────────────
router.delete("/reviews/:id", (req: Request, res: Response): void => {
  const adminKey = process.env.ADMIN_KEY;
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

  if (!adminKey || token !== adminKey) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { id } = req.params;
  const reviews = readReviews();
  const index = reviews.findIndex((r) => r.id === id);
  if (index === -1) { res.status(404).json({ error: "Review not found" }); return; }

  reviews.splice(index, 1);
  try {
    writeReviews(reviews);
  } catch (err) {
    req.log.error({ err }, "reviews: failed to write reviews file after delete");
    res.status(500).json({ error: "Failed to delete review. Please try again." });
    return;
  }

  req.log.info({ id }, "Review deleted by admin");
  res.status(200).json({ success: true });
});

// ── Public read ───────────────────────────────────────────────────────────────
router.get("/reviews", (_req: Request, res: Response): void => {
  const reviews = readReviews();
  res.json(reviews);
});

// ── Authenticated submit ──────────────────────────────────────────────────────
router.post("/reviews", async (req: Request, res: Response): Promise<void> => {
  const parsed = PostReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const { name, rating, message, reviewToken } = parsed.data;

  const email = validateReviewToken(reviewToken);
  if (!email) {
    res.status(401).json({ error: "Email verification required or session expired. Please verify your email again." });
    return;
  }

  const newReview: Review = {
    id: `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    name: name.trim(),
    rating,
    message: message.trim(),
    email,
    createdAt: new Date().toISOString(),
  };

  let reviews: Review[];
  try {
    reviews = readReviews();
    reviews.unshift(newReview);
    writeReviews(reviews);
  } catch (err) {
    req.log.error({ err }, "reviews: failed to write review");
    res.status(500).json({ error: "Failed to save review. Please try again." });
    return;
  }

  req.log.info({ id: newReview.id, name: newReview.name, rating: newReview.rating, email }, "New review saved");

  sendEmail(
    NOTIFICATION_EMAIL,
    `New Review from ${newReview.name} — ${newReview.rating}/5 stars`,
    buildReviewEmailHtml(newReview),
    req.log,
  ).catch((err) => req.log.warn({ err }, "reviews: notification email failed (non-fatal)"));

  const { email: _email, ...publicReview } = newReview;
  void _email;
  res.status(201).json(publicReview);
});

export default router;
