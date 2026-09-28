import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import { User, Wallet, StreakCycle, AuditLog } from "../src/models/index.js";
import { getStreakStatus } from "../src/services/streak.service.js";

const HOUR = 60 * 60 * 1000;
let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}`);
  }
}

const at = (base, hours) => new Date(base.getTime() + hours * HOUR);

async function run() {
  await connectDB();

  const email = `streak-test-${Date.now()}@test.local`;
  const user = await User.create({ name: "Streak Test", email, passwordHash: "not-a-real-hash" });
  await Wallet.create({ userId: user._id, ves: 120 });

  try {
    const T = new Date();

    console.log("\n1. Brand-new user");
    let s = await getStreakStatus(user, { now: T });
    check("status is NEW", s.streak.status === "NEW");
    check("currentDay is 1", s.streak.currentDay === 1);
    check("currentStreak is 0", s.streak.currentStreak === 0);
    check("canClaim is true", s.streak.canClaim === true);
    check("7 reward cards", s.rewards.length === 7);
    check("Day 1 AVAILABLE and isToday", s.rewards[0].status === "AVAILABLE" && s.rewards[0].isToday);
    check("Day 2 LOCKED", s.rewards[1].status === "LOCKED");
    check("next reward is 5 VES", s.streak.nextReward.amount === 5);
    check("ultimate reward is Day 7, 5 INR", s.streak.ultimateReward.day === 7 && s.streak.ultimateReward.amount === 5);
    check("wallet shows 120 VES", s.wallet.ves === 120);

    console.log("\n2. Day 1 claimed 1 hour ago (simulated), timer running");
    await StreakCycle.updateOne(
      { userId: user._id, status: "ACTIVE" },
      {
        $set: {
          lastClaimedDay: 1,
          lastClaimedAt: T,
          nextClaimAt: at(T, 24),
          expiresAt: at(T, 48),
        },
      }
    );
    s = await getStreakStatus(user, { now: at(T, 1) });
    check("status is ACTIVE", s.streak.status === "ACTIVE");
    check("currentStreak is 1", s.streak.currentStreak === 1);
    check("currentDay is 2", s.streak.currentDay === 2);
    check("canClaim is false", s.streak.canClaim === false);
    check("blocked reason is STILL_LOCKED", s.streak.claimBlockedReason === "STILL_LOCKED");
    check("Day 1 CLAIMED", s.rewards[0].status === "CLAIMED");
    check("Day 2 LOCKED with nextClaimAt", s.rewards[1].status === "LOCKED" && Boolean(s.rewards[1].nextClaimAt));
    check("countdown is about 23 hours", Math.abs(s.streak.secondsUntilNextClaim - 23 * 3600) <= 5);
    check("next reward is 10 VES", s.streak.nextReward.amount === 10);

    console.log("\n3. 25 hours later (timer finished)");
    s = await getStreakStatus(user, { now: at(T, 25) });
    check("canClaim is true", s.streak.canClaim === true);
    check("Day 2 AVAILABLE and isToday", s.rewards[1].status === "AVAILABLE" && s.rewards[1].isToday);
    check("countdown is 0", s.streak.secondsUntilNextClaim === 0);

    console.log("\n4. 49 hours later (missed the window, streak must reset)");
    s = await getStreakStatus(user, { now: at(T, 49) });
    check("status is RESET", s.streak.status === "RESET");
    check("currentDay is back to 1", s.streak.currentDay === 1);
    check("currentStreak is 0", s.streak.currentStreak === 0);
    check("Day 1 AVAILABLE", s.rewards[0].status === "AVAILABLE");
    check("Day 2 marked MISSED", s.rewards[1].status === "MISSED");
    check("reset info: previousStreak 1, missedDay 2", s.streak.reset?.previousStreak === 1 && s.streak.reset?.missedDay === 2);
    const cyclesAfterReset = await StreakCycle.find({ userId: user._id }).sort({ cycleNumber: 1 }).lean();
    check("2 cycles: RESET then ACTIVE", cyclesAfterReset.length === 2 && cyclesAfterReset[0].status === "RESET" && cyclesAfterReset[1].status === "ACTIVE");
    check("1 STREAK_RESET audit log", (await AuditLog.countDocuments({ userId: user._id, event: "STREAK_RESET" })) === 1);

    console.log("\n5. Same request again (reset must not repeat)");
    s = await getStreakStatus(user, { now: at(T, 49) });
    check("still 2 cycles", (await StreakCycle.countDocuments({ userId: user._id })) === 2);
    check("still 1 STREAK_RESET audit log", (await AuditLog.countDocuments({ userId: user._id, event: "STREAK_RESET" })) === 1);
    check("reset notice still shown", s.streak.status === "RESET");

    console.log("\n6. Day 7 completed, next cycle carries the wait time");
    const B = at(T, 49);
    await StreakCycle.updateOne(
      { userId: user._id, status: "ACTIVE" },
      {
        $set: {
          status: "COMPLETED",
          lastClaimedDay: 7,
          lastClaimedAt: B,
          nextClaimAt: at(B, 24),
          expiresAt: at(B, 48),
          completedAt: B,
        },
      }
    );
    s = await getStreakStatus(user, { now: at(B, 1) });
    check("new cycle (number 3) started", s.streak.cycleNumber === 3);
    check("completedCycles is 1", s.streak.completedCycles === 1);
    check("Day 1 LOCKED (waiting)", s.rewards[0].status === "LOCKED" && s.streak.canClaim === false);
    s = await getStreakStatus(user, { now: at(B, 25) });
    check("Day 1 AVAILABLE after the wait", s.rewards[0].status === "AVAILABLE" && s.streak.canClaim === true);
  } finally {
    await Promise.all([
      User.deleteOne({ _id: user._id }),
      Wallet.deleteMany({ userId: user._id }),
      StreakCycle.deleteMany({ userId: user._id }),
      AuditLog.deleteMany({ userId: user._id }),
    ]);
    await mongoose.disconnect();
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Streak check failed:", err.message);
  process.exit(1);
});