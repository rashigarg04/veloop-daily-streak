import mongoose from "mongoose";

const streakCycleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    cycleNumber: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED", "RESET"],
      default: "ACTIVE",
      required: true,
    },
    // How many days of this cycle have been claimed (0 to totalDays)
    lastClaimedDay: { type: Number, default: 0, min: 0 },
    lastClaimedAt: { type: Date, default: null },
    // When the next day unlocks
    nextClaimAt: { type: Date, default: null },
    // Last moment the next day can be claimed before the streak resets
    expiresAt: { type: Date, default: null },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    resetAt: { type: Date, default: null },
    resetReason: { type: String, default: null },
  },
  { timestamps: true }
);

// A user can have only ONE active cycle (enforced by MongoDB itself)
streakCycleSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: "ACTIVE" }, name: "one_active_cycle_per_user" }
);

streakCycleSchema.index({ userId: 1, cycleNumber: 1 }, { unique: true });

export const StreakCycle = mongoose.model("StreakCycle", streakCycleSchema);