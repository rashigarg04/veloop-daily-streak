import mongoose from "mongoose";
import { newId } from "../utils/ids.js";

const streakClaimSchema = new mongoose.Schema(
  {
    claimId: { type: String, required: true, unique: true, default: newId },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    cycleId: { type: mongoose.Schema.Types.ObjectId, ref: "StreakCycle", required: true },
    day: { type: Number, required: true, min: 1 },
    rewardId: { type: mongoose.Schema.Types.ObjectId, ref: "StreakReward", required: true },
    // Copy of the reward at claim time, so history stays correct if config changes later
    rewardSnapshot: {
      rewardType: { type: String, required: true },
      currency: { type: String, required: true },
      amount: { type: Number, required: true },
      title: { type: String, required: true },
    },
    status: { type: String, enum: ["COMPLETED", "FAILED"], default: "COMPLETED" },
    claimedAt: { type: Date, required: true },
    transactionId: { type: String, required: true },
    idempotencyKey: { type: String, default: null },
  },
  { timestamps: true }
);

// Core duplicate-claim protection
streakClaimSchema.index({ userId: 1, cycleId: 1, day: 1 }, { unique: true, name: "one_claim_per_day" });

// Optional client-supplied idempotency key (unique per user when present)
streakClaimSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } }, name: "idempotency_per_user" }
);

streakClaimSchema.index({ userId: 1, claimedAt: -1 });

export const StreakClaim = mongoose.model("StreakClaim", streakClaimSchema);