import mongoose from "mongoose";

const streakRewardSchema = new mongoose.Schema(
  {
    day: { type: Number, required: true, unique: true, min: 1 },
    rewardType: { type: String, required: true, enum: ["VES", "GIFT_CARD"] },
    currency: { type: String, required: true, enum: ["VES", "INR"] },
    amount: { type: Number, required: true, min: 0 },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: "", trim: true },
    // The frontend maps these to its own static images
    assetType: {
      type: String,
      required: true,
      enum: ["coin", "gift-box", "gift-card", "crown"],
    },
    badge: { type: String, default: null }, // e.g. "Gift Card", "Coin", "VIP"
    isUltimate: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const StreakReward = mongoose.model("StreakReward", streakRewardSchema);