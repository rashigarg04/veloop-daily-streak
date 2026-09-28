import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import { StreakConfig, StreakReward } from "../src/models/index.js";

const CONFIG = {
  key: "default",
  totalDays: 7,
  claimIntervalHours: 24,
  claimWindowHours: 24,
  resetOnMiss: true,
  onCycleComplete: "RESTART",
  isActive: true,
};

const REWARDS = [
  {
    day: 1,
    rewardType: "VES",
    currency: "VES",
    amount: 5,
    title: "Daily Reward",
    subtitle: "5 VEs",
    assetType: "coin",
    badge: null,
    isUltimate: false,
  },
  {
    day: 2,
    rewardType: "VES",
    currency: "VES",
    amount: 10,
    title: "Daily Reward",
    subtitle: "10 VEs",
    assetType: "coin",
    badge: null,
    isUltimate: false,
  },
  {
    day: 3,
    rewardType: "VES",
    currency: "VES",
    amount: 15,
    title: "Daily Reward",
    subtitle: "15 VEs",
    assetType: "coin",
    badge: null,
    isUltimate: false,
  },
  {
    day: 4,
    rewardType: "GIFT_CARD",
    currency: "INR",
    amount: 1,
    title: "Daily Reward",
    subtitle: "Amazon Gift Card",
    assetType: "gift-box",
    badge: null,
    isUltimate: false,
    metadata: { brand: "Amazon" },
  },
  {
    day: 5,
    rewardType: "GIFT_CARD",
    currency: "INR",
    amount: 2,
    title: "Daily Reward",
    subtitle: "Amazon Gift Card",
    assetType: "gift-card",
    badge: "Gift Card",
    isUltimate: false,
    metadata: { brand: "Amazon" },
  },
  {
    day: 6,
    rewardType: "VES",
    currency: "VES",
    amount: 30,
    title: "Daily Reward",
    subtitle: "30 VEs",
    assetType: "coin",
    badge: "Coin",
    isUltimate: false,
  },
  {
    day: 7,
    rewardType: "GIFT_CARD",
    currency: "INR",
    amount: 5,
    title: "Ultimate Reward",
    subtitle: "Amazon Gift Card",
    assetType: "crown",
    badge: "VIP",
    isUltimate: true,
    metadata: { brand: "Amazon" },
  },
];

async function run() {
  await connectDB();

  await StreakConfig.updateOne({ key: CONFIG.key }, { $set: CONFIG }, { upsert: true });
  console.log("Streak config saved.");

  const operations = REWARDS.map((reward) => ({
    updateOne: {
      filter: { day: reward.day },
      update: { $set: { metadata: {}, ...reward, active: true } },
      upsert: true,
    },
  }));

  await StreakReward.bulkWrite(operations);
  console.log(`${REWARDS.length} rewards saved.`);

  const saved = await StreakReward.find().sort({ day: 1 }).lean();
  console.log("\nDay | Type       | Currency | Amount | Asset     | Badge");
  console.log("----+------------+----------+--------+-----------+----------");
  saved.forEach((r) => {
    console.log(
      `${String(r.day).padEnd(3)} | ${r.rewardType.padEnd(10)} | ${r.currency.padEnd(8)} | ${String(
        r.amount
      ).padEnd(6)} | ${r.assetType.padEnd(9)} | ${r.badge ?? "-"}`
    );
  });

  await mongoose.disconnect();
  console.log("\nSeed complete.");
}

run().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});