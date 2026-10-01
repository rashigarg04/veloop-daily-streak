// Maps backend `assetType` strings to an emoji placeholder.
// Swap these for real images/animations later (PDF section 79-81) without
// touching any component logic — just edit this one file.
export const ASSET_ICON = {
  coin: "🪙",
  "gift-box": "🎁",
  "gift-card": "💳",
  crown: "👑",
};

export function formatRewardAmount(reward) {
  if (reward.currency === "INR") return `₹${reward.amount}`;
  return `+${reward.amount}`;
}

export function formatRewardSubtitle(reward) {
  if (reward.currency === "INR") return reward.subtitle || "Amazon Gift Card";
  return `${reward.amount} VEs`;
}