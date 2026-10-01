import { Router } from "express";
import {
  getDailyStreak,
  getDailyStreakStatus,
  postClaim,
  getHistory,
} from "../controllers/streak.controller.js";
import { protect } from "../middleware/auth.js";
import { apiLimiter, claimLimiter } from "../middleware/rateLimiters.js";
import { validate, claimRules, historyRules } from "../validators/streak.validator.js";

const router = Router();

// Every route here requires a valid JWT; req.user is set by `protect`.
router.use(protect);

router.get("/", apiLimiter, getDailyStreak);
router.get("/status", apiLimiter, getDailyStreakStatus);
router.post("/claim", claimLimiter, claimRules, validate, postClaim);
router.get("/history", apiLimiter, historyRules, validate, getHistory);

export default router;