import rateLimit from "express-rate-limit";
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