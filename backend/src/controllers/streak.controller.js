import { getStreakStatus } from "../services/streak.service.js";
import { claimReward } from "../services/claim.service.js";
import { StreakClaim } from "../models/index.js";

// GET /api/daily-streak — full state for the initial page load
export async function getDailyStreak(req, res) {
  const result = await getStreakStatus(req.user, { req });
  res.json({ success: true, ...result });
}

// GET /api/daily-streak/status — same data, used for lightweight polling
// (e.g. right after the frontend countdown reaches zero)
export async function getDailyStreakStatus(req, res) {
  const result = await getStreakStatus(req.user, { req });
  res.json({ success: true, ...result });
}

// POST /api/daily-streak/claim — the only state-changing streak endpoint.
// req.body.day and req.body.idempotencyKey are hints only; claimReward()
// independently verifies everything against MongoDB and server time.
export async function postClaim(req, res) {
  const { day = null, idempotencyKey = null } = req.body;
  const result = await claimReward(req.user, {
    requestedDay: day,
    idempotencyKey,
    req,
  });
  res.status(result.idempotent ? 200 : 201).json({ success: true, ...result });
}

// GET /api/daily-streak/history — paginated, this user's claims only
export async function getHistory(req, res) {
  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const skip = (page - 1) * limit;

  const [claims, total] = await Promise.all([
    StreakClaim.find({ userId: req.user._id })
      .sort({ claimedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("claimId day rewardSnapshot status claimedAt transactionId")
      .lean(),
    StreakClaim.countDocuments({ userId: req.user._id }),
  ]);

  res.json({
    success: true,
    serverTime: new Date().toISOString(),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    history: claims.map((c) => ({
      claimId: c.claimId,
      day: c.day,
      reward: c.rewardSnapshot,
      status: c.status,
      claimedAt: c.claimedAt.toISOString(),
      transactionId: c.transactionId,
    })),
  });
}