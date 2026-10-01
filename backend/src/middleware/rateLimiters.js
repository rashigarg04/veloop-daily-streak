import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "../config/env.js";

function handler(message) {
  return (req, res) =>
    res.status(429).json({ success: false, code: "RATE_LIMITED", message });
}

const isProd = env.NODE_ENV === "production";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProd ? 20 : 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: handler("Too many attempts. Please try again in a few minutes."),
});

// Claiming is a sensitive, state-changing action: keep this tight.
export const claimLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isProd ? 10 : 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? String(req.user._id) : ipKeyGenerator(req.ip)),
  handler: handler("Too many claim attempts. Please slow down and try again shortly."),
});

// General safety net for the rest of the streak routes (reads).
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isProd ? 60 : 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? String(req.user._id) : ipKeyGenerator(req.ip)),
  handler: handler("Too many requests. Please try again shortly."),
});