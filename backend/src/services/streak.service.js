import { StreakCycle, StreakClaim, Wallet } from "../models/index.js";
import { getStreakConfig, getActiveRewards, toPublicReward } from "./reward.service.js";
import { logAudit } from "./audit.service.js";

const HOUR_MS = 60 * 60 * 1000;

const toMs = (date) => new Date(date).getTime();

/**
 * Next unlock time and last-chance time, calculated from config.
 * Used by the status view here and by the claim service in the next step.
 */
export function computeClaimWindow(config, claimedAt) {
  const nextClaimAt = new Date(toMs(claimedAt) + config.claimIntervalHours * HOUR_MS);
  const expiresAt = new Date(nextClaimAt.getTime() + config.claimWindowHours * HOUR_MS);
  return { nextClaimAt, expiresAt };
}

/** The day the user should claim next (null if the cycle is already complete). */
export function calculateCurrentDay(cycle, config) {
  const day = cycle.lastClaimedDay + 1;
  return day <= config.totalDays ? day : null;
}

/** True when the claim window has passed and the streak must reset. */
export function checkMissedDay(cycle, config, now) {
  return Boolean(
    config.resetOnMiss &&
      cycle.lastClaimedDay > 0 &&
      cycle.expiresAt &&
      now.getTime() > toMs(cycle.expiresAt)
  );
}

/** Can this user claim right now? Backend decision only. */
export function checkEligibility({ user, cycle, config, now }) {
  if (!user.isActive) {
    return {
      eligible: false,
      code: "ACCOUNT_DISABLED",
      message: "This account is not eligible to claim rewards.",
    };
  }

  const day = calculateCurrentDay(cycle, config);
  if (day === null) {
    return {
      eligible: false,
      code: "CYCLE_COMPLETE",
      message: "You have completed this streak. A new one will start soon.",
    };
  }

  if (cycle.nextClaimAt && now.getTime() < toMs(cycle.nextClaimAt)) {
    return {
      eligible: false,
      code: "STILL_LOCKED",
      message: "Your next reward is not available yet.",
    };
  }

  return { eligible: true, code: null, message: null, day };
}

async function findActiveCycle(userId) {
  return StreakCycle.findOne({ userId, status: "ACTIVE" }).lean();
}

async function createCycle(userId, now) {
  const last = await StreakCycle.findOne({ userId }).sort({ cycleNumber: -1 }).lean();

  // After a completed cycle, the wait time carries over so Day 1 is not instantly claimable
  const carryOver =
    last && last.status === "COMPLETED" && last.nextClaimAt && toMs(last.nextClaimAt) > now.getTime()
      ? last.nextClaimAt
      : null;

  try {
    const created = await StreakCycle.create({
      userId,
      cycleNumber: (last?.cycleNumber ?? 0) + 1,
      status: "ACTIVE",
      startedAt: now,
      nextClaimAt: carryOver,
    });
    return created.toObject();
  } catch (error) {
    // Another request created the cycle first (unique index): use that one
    if (error?.code === 11000) {
      const existing = await findActiveCycle(userId);
      if (existing) return existing;
    }
    throw error;
  }
}

/** Marks the cycle as RESET (only once, even with parallel requests) and starts a new one. */
export async function resetStreak(cycle, now, { req = null, reason = "MISSED_DAY" } = {}) {
  const updated = await StreakCycle.findOneAndUpdate(
    { _id: cycle._id, status: "ACTIVE" },
    { $set: { status: "RESET", resetAt: now, resetReason: reason } },
    { returnDocument: "after" }
  ).lean();

  if (updated) {
    await logAudit("STREAK_RESET", {
      req,
      userId: cycle.userId,
      metadata: {
        cycleId: String(cycle._id),
        reason,
        previousStreak: cycle.lastClaimedDay,
        lastClaimedAt: cycle.lastClaimedAt,
        expiresAt: cycle.expiresAt,
        serverTime: now.toISOString(),
      },
    });
  }

  const active = await findActiveCycle(cycle.userId);
  return active ?? createCycle(cycle.userId, now);
}

/** Returns the user's up-to-date ACTIVE cycle, resetting or creating one when needed. */
export async function resolveCycle(userId, config, now, { req = null } = {}) {
  const active = await findActiveCycle(userId);
  if (!active) return createCycle(userId, now);

  if (checkMissedDay(active, config, now)) {
    return resetStreak(active, now, { req });
  }
  return active;
}

function buildCards({ rewards, cycle, now, claimsByDay, missedDay }) {
  const lastClaimed = cycle.lastClaimedDay;
  const timerRunning = cycle.nextClaimAt && now.getTime() < toMs(cycle.nextClaimAt);

  return rewards.map((reward) => {
    const day = reward.day;
    let status = "LOCKED";
    let isToday = false;

    if (day <= lastClaimed) {
      status = "CLAIMED";
    } else if (day === lastClaimed + 1) {
      status = timerRunning ? "LOCKED" : "AVAILABLE";
      isToday = !timerRunning;
    } else if (missedDay && day === missedDay) {
      status = "MISSED";
    }

    const card = {
      day,
      status,
      isToday,
      isUltimate: reward.isUltimate,
      badge: reward.badge,
      reward: toPublicReward(reward),
    };

    if (status === "CLAIMED") {
      card.claimedAt = claimsByDay.get(day) ?? null;
    }
    if (day === lastClaimed + 1 && timerRunning) {
      card.nextClaimAt = new Date(cycle.nextClaimAt).toISOString();
    }
    return card;
  });
}

/**
 * Full streak state for the page. `now` is only for tests: controllers never pass it,
 * so the real server clock is always used.
 */
export async function getStreakStatus(user, { req = null, now = new Date() } = {}) {
  const config = await getStreakConfig();
  const rewards = await getActiveRewards(config);
  const cycle = await resolveCycle(user._id, config, now, { req });

  const [wallet, claims, completedCycles, resetCycle] = await Promise.all([
    Wallet.findOne({ userId: user._id }).lean(),
    StreakClaim.find({ cycleId: cycle._id }).select("day claimedAt").lean(),
    StreakCycle.countDocuments({ userId: user._id, status: "COMPLETED" }),
    cycle.lastClaimedDay === 0 && cycle.cycleNumber > 1
      ? StreakCycle.findOne({
          userId: user._id,
          cycleNumber: cycle.cycleNumber - 1,
          status: "RESET",
        }).lean()
      : null,
  ]);

  const claimsByDay = new Map(claims.map((c) => [c.day, c.claimedAt.toISOString()]));

  const reset = resetCycle
    ? {
        previousStreak: resetCycle.lastClaimedDay,
        missedDay: resetCycle.lastClaimedDay + 1,
        resetAt: resetCycle.resetAt?.toISOString() ?? null,
        reason: resetCycle.resetReason,
      }
    : null;

  const eligibility = checkEligibility({ user, cycle, config, now });
  const currentDay = calculateCurrentDay(cycle, config);
  const timerRunning = Boolean(cycle.nextClaimAt && now.getTime() < toMs(cycle.nextClaimAt));

  const cards = buildCards({
    rewards,
    cycle,
    now,
    claimsByDay,
    missedDay: reset?.missedDay ?? null,
  });

  const nextRewardDoc = currentDay ? rewards.find((r) => r.day === currentDay) : null;
  const ultimateDoc = rewards.find((r) => r.isUltimate) ?? rewards[rewards.length - 1];

  let streakStatus = "ACTIVE";
  if (reset) streakStatus = "RESET";
  else if (cycle.lastClaimedDay === 0) streakStatus = "NEW";

  return {
    serverTime: now.toISOString(),
    streak: {
      status: streakStatus,
      currentStreak: cycle.lastClaimedDay,
      currentDay,
      checkedIn: cycle.lastClaimedDay,
      totalRewards: config.totalDays,
      canClaim: eligibility.eligible,
      claimBlockedReason: eligibility.code,
      nextClaimAt: timerRunning ? new Date(cycle.nextClaimAt).toISOString() : null,
      secondsUntilNextClaim: timerRunning
        ? Math.ceil((toMs(cycle.nextClaimAt) - now.getTime()) / 1000)
        : 0,
      cycleNumber: cycle.cycleNumber,
      completedCycles,
      reset,
      nextReward: nextRewardDoc
        ? { day: nextRewardDoc.day, ...toPublicReward(nextRewardDoc) }
        : null,
      ultimateReward: {
        day: ultimateDoc.day,
        unlockDay: ultimateDoc.day,
        status: cards.find((c) => c.day === ultimateDoc.day).status,
        ...toPublicReward(ultimateDoc),
      },
    },
    rewards: cards,
    wallet: {
      ves: wallet?.ves ?? 0,
      giftCardInr: wallet?.giftCardInr ?? 0,
    },
  };
}