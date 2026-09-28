import mongoose from "mongoose";

const streakConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    totalDays: { type: Number, required: true, default: 7, min: 1, max: 60 },
    // Hours to wait after a claim before the next day unlocks
    claimIntervalHours: { type: Number, required: true, default: 24, min: 0 },
    // Extra hours after unlock in which the user can still claim
    claimWindowHours: { type: Number, required: true, default: 24, min: 0 },
    resetOnMiss: { type: Boolean, default: true },
    // What happens after Day 7 is claimed
    onCycleComplete: { type: String, enum: ["RESTART"], default: "RESTART" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const StreakConfig = mongoose.model("StreakConfig", streakConfigSchema);