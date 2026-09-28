import { StreakConfig, StreakReward } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";

export async function getStreakConfig() {
  const config = await StreakConfig.findOne({ key: "default", isActive: true }).lean();
  if (!config) {
    throw new ApiError(503, "Daily streak is not available right now.", "STREAK_NOT_CONFIGURED");
  }
  return config;
}

export async function getActiveRewards(config) {
  const rewards = await StreakReward.find({
    active: true,
    day: { $lte: config.totalDays },
  })
    .sort({ day: 1 })
    .lean();

  const valid =
    rewards.length === config.totalDays && rewards.every((reward, index) => reward.day === index + 1);

  if (!valid) {
    console.error("Reward configuration invalid: expected days 1.." + config.totalDays);
    throw new ApiError(503, "Daily streak is not available right now.", "REWARD_CONFIG_INVALID");
  }

  return rewards;
}

export function toPublicReward(reward) {
  return {
    rewardType: reward.rewardType,
    currency: reward.currency,
    amount: reward.amount,
    title: reward.title,
    subtitle: reward.subtitle,
    assetType: reward.assetType,
    metadata: reward.metadata ?? {},
  };
}