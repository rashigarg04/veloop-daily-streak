import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import * as models from "../src/models/index.js";

async function run() {
  await connectDB();

  const modelList = [
    models.User,
    models.Wallet,
    models.StreakConfig,
    models.StreakReward,
    models.StreakCycle,
    models.StreakClaim,
    models.WalletTransaction,
    models.AuditLog,
  ];

  for (const Model of modelList) {
    await Model.createCollection().catch(() => {}); // ignore "already exists"
    await Model.syncIndexes();
    const indexes = await Model.collection.indexes();
    console.log(`\n${Model.modelName} (${Model.collection.name})`);
    indexes.forEach((i) => console.log(`  - ${i.name}${i.unique ? "  [unique]" : ""}`));
  }

  console.log("\nAll models and indexes are ready.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Model check failed:", err.message);
  process.exit(1);
});