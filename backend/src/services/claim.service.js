import mongoose from "mongoose";
import { StreakClaim, StreakCycle, Wallet, WalletTransaction } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { newId, newReferenceId } from "../utils/ids.js";
import { getStreakConfig, getActiveRewards } from "./reward.service.js";
import {
  calculateCurrentDay,
  checkEligibility,
  computeClaimWindow,
  resolveCycle,
} from "./streak.service.js";
import { logAudit } from "./audit.service.js";

const ELIGIBILITY_STATUS = {
  STILL_LOCKED: 409,
  ACCOUNT_DISABLED: 403,
  CYCLE_COMPLETE: 409,
};

function walletFieldFor(currency) {
  return currency === "INR" ? "giftCardInr" : "ves";
}

function publicWallet(wallet) {
  return { ves: wallet?.ves ?? 0, giftCardInr: wallet?.giftCardInr ?? 0 };
}

/** Logs the rejection, then throws a safe error for the client. */
async function reject({ req, user, event = "STREAK_CLAIM_REJECTED", status, code, message, metadata = {} }) {
  await logAudit(event, { req, userId: user._id, metadata: { code, ...metadata } });
  throw new ApiError(status, message, code);
}

/** Result for a claim that already happened (idempotent replay). */
async function buildReplay(user, claim) {
  const [transaction, wallet] = await Promise.all([
    WalletTransaction.findOne({ transactionId: claim.transactionId }).lean(),
    Wallet.findOne({ userId: user._id }).lean(),
  ]);

  return {
    idempotent: true,
    claim: {
      claimId: claim.claimId,
      day: claim.day,
      claimedAt: claim.claimedAt.toISOString(),
      transactionId: claim.transactionId,
      referenceId: transaction?.referenceId ?? null,
    },
    reward: { ...claim.rewardSnapshot },
    wallet: publicWallet(wallet),
  };
}

/**
 * Claims today's reward for the authenticated user.
 *
 * Only `requestedDay` and `idempotencyKey` come from the client, and both are treated
 * as hints that get verified. `now` is for tests only: controllers never pass it.
 */
export async function claimReward(
  user,
  { requestedDay = null, idempotencyKey = null, req = null, now = new Date() } = {}
) {
  await logAudit("STREAK_CLAIM_REQUEST", {
    req,
    userId: user._id,
    metadata: { requestedDay, hasIdempotencyKey: Boolean(idempotencyKey) },
  });

  // 1. Same idempotency key as an earlier successful claim: return that result
  if (idempotencyKey) {
    const previous = await StreakClaim.findOne({ userId: user._id, idempotencyKey }).lean();
    if (previous) {
      await logAudit("DUPLICATE_CLAIM", {
        req,
        userId: user._id,
        metadata: { reason: "IDEMPOTENT_REPLAY", day: previous.day },
      });
      return buildReplay(user, previous);
    }
  }

  const config = await getStreakConfig();
  const rewards = await getActiveRewards(config);

  // 2. Get the up-to-date cycle. If the streak was missed it is reset here.
  const before = await StreakCycle.findOne({ userId: user._id, status: "ACTIVE" }).select("_id").lean();
  const cycle = await resolveCycle(user._id, config, now, { req });

  if (before && String(before._id) !== String(cycle._id)) {
    await reject({
      req,
      user,
      status: 409,
      code: "STREAK_RESET",
      message: "Your streak has been reset. Start again from Day 1.",
    });
  }

  // 3. The client's day is only a hint. It must match what the database says.
  const expectedDay = calculateCurrentDay(cycle, config);

  if (requestedDay !== null) {
    if (!Number.isInteger(requestedDay)) {
      await reject({
        req,
        user,
        event: "INVALID_CLAIM",
        status: 400,
        code: "INVALID_DAY",
        message: "That reward is not available to claim.",
        metadata: { requestedDay },
      });
    }

    if (requestedDay <= cycle.lastClaimedDay) {
      await reject({
        req,
        user,
        event: "DUPLICATE_CLAIM",
        status: 409,
        code: "ALREADY_CLAIMED",
        message: "This reward has already been claimed.",
        metadata: { requestedDay, lastClaimedDay: cycle.lastClaimedDay },
      });
    }

    if (requestedDay !== expectedDay) {
      await reject({
        req,
        user,
        event: "INVALID_CLAIM",
        status: 400,
        code: "INVALID_DAY",
        message: "That reward is not available to claim.",
        metadata: { requestedDay, expectedDay },
      });
    }
  }

  // 4. Account active, cycle not complete, timer finished (server time)
  const eligibility = checkEligibility({ user, cycle, config, now });
  if (!eligibility.eligible) {
    await reject({
      req,
      user,
      status: ELIGIBILITY_STATUS[eligibility.code] ?? 409,
      code: eligibility.code,
      message: eligibility.message,
      metadata: { expectedDay },
    });
  }

  const day = eligibility.day;
  const reward = rewards.find((r) => r.day === day);
  const walletField = walletFieldFor(reward.currency);
  const isFinalDay = day >= config.totalDays;
  const { nextClaimAt, expiresAt } = computeClaimWindow(config, now);

  const claimId = newId();
  const transactionId = newId();
  const referenceId = newReferenceId("STREAK");

  // 5. One atomic transaction: cycle + wallet + ledger + claim
  const session = await mongoose.startSession();
  let walletAfter = null;

  try {
    await session.withTransaction(async () => {
      walletAfter = null;

      // Matches only if this is STILL the next day and the timer is finished.
      // A parallel or repeated request finds nothing here and is rejected.
      const advanced = await StreakCycle.findOneAndUpdate(
        {
          _id: cycle._id,
          status: "ACTIVE",
          lastClaimedDay: day - 1,
          $or: [{ nextClaimAt: null }, { nextClaimAt: { $lte: now } }],
        },
        {
          $set: {
            lastClaimedDay: day,
            lastClaimedAt: now,
            nextClaimAt,
            expiresAt,
            ...(isFinalDay ? { status: "COMPLETED", completedAt: now } : {}),
          },
        },
        { returnDocument: "after", session }
      );

      if (!advanced) {
        throw new ApiError(409, "This reward has already been claimed.", "ALREADY_CLAIMED");
      }

      const updatedWallet = await Wallet.findOneAndUpdate(
        { userId: user._id },
        { $inc: { [walletField]: reward.amount } },
        { returnDocument: "after", upsert: true, setDefaultsOnInsert: true, session }
      );

      const balanceAfter = updatedWallet[walletField];
      const balanceBefore = balanceAfter - reward.amount;

      await WalletTransaction.create(
        [
          {
            transactionId,
            userId: user._id,
            currency: reward.currency,
            type: "CREDIT",
            amount: reward.amount,
            source: "DAILY_STREAK",
            streakDay: day,
            referenceId,
            claimId,
            balanceBefore,
            balanceAfter,
            status: "SUCCESS",
          },
        ],
        { session }
      );

      await StreakClaim.create(
        [
          {
            claimId,
            userId: user._id,
            cycleId: cycle._id,
            day,
            rewardId: reward._id,
            rewardSnapshot: {
              rewardType: reward.rewardType,
              currency: reward.currency,
              amount: reward.amount,
              title: reward.title,
            },
            status: "COMPLETED",
            claimedAt: now,
            transactionId,
            idempotencyKey: idempotencyKey ?? null,
          },
        ],
        { session }
      );

      walletAfter = publicWallet(updatedWallet);
    });
  } catch (error) {
    const isDuplicate =
      error?.code === 11000 || (error instanceof ApiError && error.code === "ALREADY_CLAIMED");

    if (isDuplicate) {
      // Same idempotency key sent twice at the same moment: return the winner's result
      if (idempotencyKey) {
        const winner = await StreakClaim.findOne({ userId: user._id, idempotencyKey }).lean();
        if (winner) {
          await logAudit("DUPLICATE_CLAIM", {
            req,
            userId: user._id,
            metadata: { reason: "IDEMPOTENT_REPLAY", day: winner.day },
          });
          return buildReplay(user, winner);
        }
      }

      await reject({
        req,
        user,
        event: "DUPLICATE_CLAIM",
        status: 409,
        code: "ALREADY_CLAIMED",
        message: "This reward has already been claimed.",
        metadata: { day },
      });
    }

    throw error;
  } finally {
    await session.endSession();
  }

  await logAudit("STREAK_CLAIM_SUCCESS", {
    req,
    userId: user._id,
    metadata: {
      claimId,
      transactionId,
      referenceId,
      day,
      cycleId: String(cycle._id),
      currency: reward.currency,
      amount: reward.amount,
    },
  });

  return {
    idempotent: false,
    claim: {
      claimId,
      day,
      claimedAt: now.toISOString(),
      transactionId,
      referenceId,
    },
    reward: {
      rewardType: reward.rewardType,
      currency: reward.currency,
      amount: reward.amount,
      title: reward.title,
    },
    wallet: walletAfter,
  };
}