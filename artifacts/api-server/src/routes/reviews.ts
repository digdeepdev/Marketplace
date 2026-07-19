import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import fs from "fs";
import path from "path";
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
});

export type Review = z.infer<typeof ReviewSchema>;

const PostReviewBody = z.object({
  name: z.string().min(1, "Name is required").max(100),
  rating: z.number().int().min(1).max(5),
  message: z.string().min(1, "Message is required").max(500),
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

function buildReviewEmailHtml(review: Review): string {
  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
  return `<div style="font-family:Arial,sans-serif;max-width:600px">
    <h2 style="color:#136FD3">⭐ New Review Submitted</h2>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Name</strong></td><td style="padding:8px;border:1px solid #ddd">${review.name}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Rating</strong></td><td style="padding:8px;border:1px solid #ddd">${stars} (${review.rating}/5)</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Message</strong></td><td style="padding:8px;border:1px solid #ddd">${review.message}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><strong>Date</strong></td><td style="padding:8px;border:1px solid #ddd">${new Date(review.createdAt).toLocaleString()}</td></tr>
    </table>
  </div>`;
}

async function sendReviewEmail(review: Review, log?: import("pino").Logger): Promise<void> {
  const subject = `New Review from ${review.name} — ${review.rating}/5 stars`;
  const html = buildReviewEmailHtml(review);
  const transporter = makeTransporter();

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Marketplace Reviews" <${SMTP_USER}>`,
        to: NOTIFICATION_EMAIL,
        subject,
        html,
      });
      return;
    } catch (err) {
      log?.warn({ err }, "reviews: SMTP failed; falling back to Resend");
    }
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    log?.warn("reviews: no SMTP or RESEND_API_KEY configured — email skipped");
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: `Marketplace Reviews <${FROM_EMAIL}>`, to: NOTIFICATION_EMAIL, subject, html }),
    });
    if (!res.ok) log?.warn({ status: res.status }, "reviews: Resend returned non-OK status");
  } catch (err) {
    log?.warn({ err }, "reviews: Resend request failed");
  }
}

router.get("/reviews", (_req: Request, res: Response): void => {
  const reviews = readReviews();
  res.json(reviews);
});

router.post("/reviews", async (req: Request, res: Response): Promise<void> => {
  const parsed = PostReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const { name, rating, message } = parsed.data;
  const newReview: Review = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    rating,
    message: message.trim(),
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

  req.log.info({ id: newReview.id, name: newReview.name, rating: newReview.rating }, "New review saved");

  sendReviewEmail(newReview, req.log).catch((err) => {
    req.log.warn({ err }, "reviews: email send failed (non-fatal)");
  });

  res.status(201).json(newReview);
});

export default router;
