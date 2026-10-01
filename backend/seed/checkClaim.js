import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import {
  User,
  Wallet,
  StreakCycle,
  StreakClaim,
  WalletTransaction,
  AuditLog,
} from "../src/models/index.js";
import { getStreakStatus } from "../src/services/streak.service.js";
import { claimReward } from "../src/services/claim.service.js";

const HOUR = 60 * 60 * 1000;
let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    passed += 1;
    console.log("  PASS  " + name);
  } else {
    failed += 1;
    console.log("  FAIL  " + name);
  }
}

function at(base, hours) {
  return new Date(base.getTime() + hours * HOUR);
}

async function errorCode(fn) {
  try {
    await fn();
    return null;
  } catch (error) {
    return error.code || "UNKNOWN";
  }
}

async function run() {
  await connectDB();

  const email = "claim-test-" + Date.now() + "@test.local";
  const user = await User.create({ name: "Claim Test", email: email, passwordHash: "not-a-real-hash" });
  await Wallet.create({ userId: user._id, ves: 120 });

  const walletOf = function () {
    return Wallet.findOne({ userId: user._id }).lean();
  };
  const auditCount = function (event) {
    return AuditLog.countDocuments({ userId: user._id, event: event });
  };

  try {
    const T = new Date();

    console.log("\n1. Day 1 claim (new user)");
    let r = await claimReward(user, { now: T });
    check("Day 1 claim succeeded", r.claim.day === 1 && r.idempotent === false);
    check("wallet ves is 125 (120 + 5)", r.wallet.ves === 125);
    check("reference id starts with STREAK-", r.claim.referenceId.startsWith("STREAK-"));

    let s = await getStreakStatus(user, { now: at(T, 1) });
    check("Day 1 is CLAIMED", s.rewards[0].status === "CLAIMED");
    check("Day 2 is LOCKED with a running timer", s.rewards[1].status === "LOCKED" && s.streak.secondsUntilNextClaim > 0);

    const activeAfterDay1 = await StreakCycle.findOne({ userId: user._id, status: "ACTIVE" }).lean();
    check("nextClaimAt is exactly claim time + 24h", activeAfterDay1.nextClaimAt.getTime() === at(T, 24).getTime());

    console.log("\n2. Claim while locked (1 hour later)");
    check("rejected with STILL_LOCKED", (await errorCode(function () { return claimReward(user, { now: at(T, 1) }); })) === "STILL_LOCKED");
    check("wallet unchanged", (await walletOf()).ves === 125);

    console.log("\n3. Fake day, duplicate day, valid Day 2 (25 hours later)");
    check("fake Day 7 rejected with INVALID_DAY", (await errorCode(function () { return claimReward(user, { requestedDay: 7, now: at(T, 25) }); })) === "INVALID_DAY");
    check("re-claiming Day 1 rejected with ALREADY_CLAIMED", (await errorCode(function () { return claimReward(user, { requestedDay: 1, now: at(T, 25) }); })) === "ALREADY_CLAIMED");
    check("non-integer day rejected with INVALID_DAY", (await errorCode(function () { return claimReward(user, { requestedDay: 2.5, now: at(T, 25) }); })) === "INVALID_DAY");

    r = await claimReward(user, { requestedDay: 2, now: at(T, 25) });
    check("Day 2 claim succeeded", r.claim.day === 2 && r.reward.amount === 10);
    check("wallet ves is 135", r.wallet.ves === 135);

    console.log("\n4. Database integrity (claim, reward, transaction, balance)");
    const claim2 = await StreakClaim.findOne({ userId: user._id, day: 2 }).lean();
    const tx2 = await WalletTransaction.findOne({ transactionId: claim2.transactionId }).lean();
    check("claim is linked to a ledger transaction", Boolean(tx2) && tx2.claimId === claim2.claimId);
    check("ledger balance went 125 to 135", tx2.balanceBefore === 125 && tx2.balanceAfter === 135);
    check("ledger source is DAILY_STREAK, day 2, amount 10", tx2.source === "DAILY_STREAK" && tx2.streakDay === 2 && tx2.amount === 10);
    check("claim stores a reward snapshot of 10 VES", claim2.rewardSnapshot.amount === 10 && claim2.rewardSnapshot.currency === "VES");

    console.log("\n5. Two simultaneous Day 3 claims");
    const results = await Promise.allSettled([
      claimReward(user, { now: at(T, 50) }),
      claimReward(user, { now: at(T, 50) }),
    ]);
    check("exactly one request succeeded", results.filter(function (x) { return x.status === "fulfilled"; }).length === 1);
    check("exactly one request was rejected", results.filter(function (x) { return x.status === "rejected"; }).length === 1);
    check("wallet ves is 150 (only +15, not +30)", (await walletOf()).ves === 150);
    check("3 claims stored", (await StreakClaim.countDocuments({ userId: user._id })) === 3);

    console.log("\n6. Idempotency key on Day 4 (gift card)");
    r = await claimReward(user, { requestedDay: 4, idempotencyKey: "test-key-12345", now: at(T, 75) });
    check("Day 4 pays a 1 INR gift card", r.reward.currency === "INR" && r.reward.amount === 1);
    check("giftCardInr is 1 and ves stays 150", r.wallet.giftCardInr === 1 && r.wallet.ves === 150);

    const replay = await claimReward(user, { requestedDay: 4, idempotencyKey: "test-key-12345", now: at(T, 75) });
    check("replay is flagged idempotent with the same claimId", replay.idempotent === true && replay.claim.claimId === r.claim.claimId);
    check("replay did not pay again", (await walletOf()).giftCardInr === 1);
    check("still only 4 claims stored", (await StreakClaim.countDocuments({ userId: user._id })) === 4);

    console.log("\n7. Missed the window (124 hours after start)");
    check("claim rejected with STREAK_RESET", (await errorCode(function () { return claimReward(user, { now: at(T, 124) }); })) === "STREAK_RESET");

    s = await getStreakStatus(user, { now: at(T, 124) });
    check("status is RESET", s.streak.status === "RESET");
    check("current day is back to 1", s.streak.currentDay === 1);
    check("Day 1 is AVAILABLE again", s.rewards[0].status === "AVAILABLE");

    const walletAfterReset = await walletOf();
    check("wallet unchanged by the rejected claim", walletAfterReset.ves === 150 && walletAfterReset.giftCardInr === 1);

    console.log("\n8. Blocked account");
    user.isActive = false;
    check("rejected with ACCOUNT_DISABLED", (await errorCode(function () { return claimReward(user, { now: at(T, 124) }); })) === "ACCOUNT_DISABLED");
    user.isActive = true;

    console.log("\n9. Final day (Day 7) completes the cycle");
    await StreakCycle.updateOne(
      { userId: user._id, status: "ACTIVE" },
      {
        $set: {
          lastClaimedDay: 6,
          lastClaimedAt: at(T, 124),
          nextClaimAt: at(T, 124),
          expiresAt: at(T, 148),
        },
      }
    );
    r = await claimReward(user, { requestedDay: 7, now: at(T, 125) });
    check("Day 7 pays a 5 INR gift card", r.claim.day === 7 && r.reward.currency === "INR" && r.reward.amount === 5);
    check("giftCardInr is now 6", r.wallet.giftCardInr === 6);

    const completed = await StreakCycle.findOne({ userId: user._id, cycleNumber: 2 }).lean();
    check("cycle 2 is COMPLETED", completed.status === "COMPLETED");

    s = await getStreakStatus(user, { now: at(T, 125) });
    check("new cycle 3 started", s.streak.cycleNumber === 3);
    check("completedCycles is 1", s.streak.completedCycles === 1);
    check("Day 1 of the new cycle is LOCKED (waiting)", s.rewards[0].status === "LOCKED");

    console.log("\n10. Audit logs");
    check("5 STREAK_CLAIM_SUCCESS logs", (await auditCount("STREAK_CLAIM_SUCCESS")) === 5);
    check("2 INVALID_CLAIM logs", (await auditCount("INVALID_CLAIM")) === 2);
    check("at least 2 DUPLICATE_CLAIM logs", (await auditCount("DUPLICATE_CLAIM")) >= 2);
    check("1 STREAK_RESET log", (await auditCount("STREAK_RESET")) === 1);
  } finally {
    await Promise.all([
      User.deleteOne({ _id: user._id }),
      Wallet.deleteMany({ userId: user._id }),
      StreakCycle.deleteMany({ userId: user._id }),
      StreakClaim.deleteMany({ userId: user._id }),
      WalletTransaction.deleteMany({ userId: user._id }),
      AuditLog.deleteMany({ userId: user._id }),
    ]);
    await mongoose.disconnect();
  }

  console.log("\nResult: " + passed + " passed, " + failed + " failed");
  if (failed > 0) process.exit(1);
}

run().catch(function (err) {
  console.error("Claim check failed:", err.message);
  process.exit(1);
});