import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { connectDB } from "../src/config/db.js";
import { StreakCycle } from "../src/models/index.js";

const BASE_URL = `http://localhost:${env.PORT}`;
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

async function api(method, path, { token = null, body = null } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  return { status: res.status, body: json };
}

async function registerUser(suffix) {
  const email = `apitest-${suffix}-${Date.now()}@test.local`;
  const r = await api("POST", "/api/auth/register", {
    body: { name: `API Test ${suffix}`, email, password: "Test1234" },
  });
  if (r.status !== 201) {
    throw new Error(`Failed to register test user: ${JSON.stringify(r.body)}`);
  }
  return { token: r.body.token, userId: r.body.user.id, email };
}

/** Rewinds this user's active cycle so its timer appears to have already finished. */
async function rewindCycleBy(userId, hours) {
  const cycle = await StreakCycle.findOne({ userId, status: "ACTIVE" });
  if (!cycle) throw new Error("No active cycle found to rewind");

  const shift = hours * HOUR;
  cycle.lastClaimedAt = cycle.lastClaimedAt ? new Date(cycle.lastClaimedAt.getTime() - shift) : null;
  cycle.nextClaimAt = cycle.nextClaimAt ? new Date(cycle.nextClaimAt.getTime() - shift) : null;
  cycle.expiresAt = cycle.expiresAt ? new Date(cycle.expiresAt.getTime() - shift) : null;
  await cycle.save();
}

async function cleanupUser(userId) {
  await mongoose.connection.collection("users").deleteOne({ _id: new mongoose.Types.ObjectId(userId) });
  await mongoose.connection.collection("wallets").deleteMany({ userId: new mongoose.Types.ObjectId(userId) });
  await mongoose.connection.collection("streakcycles").deleteMany({ userId: new mongoose.Types.ObjectId(userId) });
  await mongoose.connection.collection("streakclaims").deleteMany({ userId: new mongoose.Types.ObjectId(userId) });
  await mongoose.connection.collection("wallettransactions").deleteMany({ userId: new mongoose.Types.ObjectId(userId) });
  await mongoose.connection.collection("auditlogs").deleteMany({ userId: new mongoose.Types.ObjectId(userId) });
}

async function run() {
  // Used only to rewind timers directly in the database; all actual
  // requests below go through the real HTTP API, exactly like a browser.
  await connectDB();

  let userA, userB;

  try {
    console.log("\n=== SECTION 1: Health check ===");
    const health = await api("GET", "/api/health");
    check("health check returns success", health.status === 200 && health.body.success === true);

    console.log("\n=== SECTION 2: Registration and authentication ===");
    userA = await registerUser("A");
    userB = await registerUser("B");
    check("userA registered with a token", Boolean(userA.token));
    check("userB registered with a token", Boolean(userB.token));

    const noToken = await api("GET", "/api/daily-streak");
    check("no token -> 401 UNAUTHENTICATED", noToken.status === 401 && noToken.body.code === "UNAUTHENTICATED");

    const fakeToken = await api("GET", "/api/daily-streak", { token: "not.a.real.token" });
    check("fake token -> 401 INVALID_TOKEN", fakeToken.status === 401 && fakeToken.body.code === "INVALID_TOKEN");

    console.log("\n=== SECTION 3: Day 1 claim (correct claim test, PDF #96) ===");
    const initial = await api("GET", "/api/daily-streak", { token: userA.token });
    check("new user sees Day 1 AVAILABLE and isToday", initial.body.rewards[0].status === "AVAILABLE" && initial.body.rewards[0].isToday === true);

    const claimDay1 = await api("POST", "/api/daily-streak/claim", { token: userA.token, body: { day: 1 } });
    check("Day 1 claim succeeds with 201", claimDay1.status === 201 && claimDay1.body.claim.day === 1);
    check("wallet credited +5 VEs (120 -> 125)", claimDay1.body.wallet.ves === 125);

    console.log("\n=== SECTION 4: Duplicate claim (PDF #101) ===");
    const dup1 = await api("POST", "/api/daily-streak/claim", { token: userA.token, body: { day: 1 } });
    check("first duplicate rejected: ALREADY_CLAIMED", dup1.status === 409 && dup1.body.code === "ALREADY_CLAIMED");
    const dup2 = await api("POST", "/api/daily-streak/claim", { token: userA.token, body: { day: 1 } });
    check("second duplicate also rejected, not double-paid", dup2.status === 409 && dup2.body.code === "ALREADY_CLAIMED");

    console.log("\n=== SECTION 5: Locked day (PDF #99 / timer) ===");
    const lockedClaim = await api("POST", "/api/daily-streak/claim", { token: userA.token, body: { day: 2 } });
    check("Day 2 still locked right after Day 1", lockedClaim.status === 409 && lockedClaim.body.code === "STILL_LOCKED");

    console.log("\n=== SECTION 6: Fake day jump (PDF #99) ===");
    const fakeDay = await api("POST", "/api/daily-streak/claim", { token: userA.token, body: { day: 7 } });
    check("direct jump to Day 7 rejected: INVALID_DAY", fakeDay.status === 400 && fakeDay.body.code === "INVALID_DAY");

    console.log("\n=== SECTION 7: Fake reward / currency / userId / streak (PDF #98, #100) ===");
    const evilClaim = await api("POST", "/api/daily-streak/claim", {
      token: userA.token,
      body: { day: 2, reward: 999999, currency: "VES", amount: 999999, userId: userB.userId, streak: 99 },
    });
    check(
      "fake payload has NO effect — still just STILL_LOCKED, no 999999 payout",
      evilClaim.status === 409 && evilClaim.body.code === "STILL_LOCKED"
    );

    console.log("\n=== SECTION 8: Cross-user isolation (PDF #100, #45) ===");
    const userAStatusViaB = await api("GET", "/api/daily-streak", { token: userB.token });
    check("userB sees their OWN streak, not userA's", userAStatusViaB.body.streak.currentStreak === 0);
    const crossClaim = await api("POST", "/api/daily-streak/claim", {
      token: userB.token,
      body: { day: 1, userId: userA.userId },
    });
    check("userB claiming with userA's id in body still only affects userB", crossClaim.status === 201 && crossClaim.body.wallet.ves === 125);
    const userAUnaffected = await api("GET", "/api/daily-streak", { token: userA.token });
    check("userA's streak unchanged by userB's request", userAUnaffected.body.streak.currentStreak === 1);

    console.log("\n=== SECTION 9: Timer completes, Day 2 becomes claimable (PDF #47, #48) ===");
    await rewindCycleBy(userA.userId, 25);
    const afterWait = await api("GET", "/api/daily-streak", { token: userA.token });
    check("after 25h rewind, Day 2 is AVAILABLE and isToday", afterWait.body.rewards[1].status === "AVAILABLE" && afterWait.body.rewards[1].isToday === true);

    const claimDay2 = await api("POST", "/api/daily-streak/claim", { token: userA.token, body: { day: 2 } });
    check("Day 2 claim succeeds", claimDay2.status === 201 && claimDay2.body.claim.day === 2);
    check("wallet credited +10 VEs (125 -> 135)", claimDay2.body.wallet.ves === 135);

    console.log("\n=== SECTION 10: Concurrent claim protection (PDF #102) ===");
    await rewindCycleBy(userA.userId, 25);
    const [c1, c2] = await Promise.all([
      api("POST", "/api/daily-streak/claim", { token: userA.token, body: { day: 3 } }),
      api("POST", "/api/daily-streak/claim", { token: userA.token, body: { day: 3 } }),
    ]);
    const successes = [c1, c2].filter((r) => r.status === 201);
    const rejections = [c1, c2].filter((r) => r.status === 409);
    check("exactly ONE of the two simultaneous requests succeeded", successes.length === 1);
    check("exactly ONE was rejected (no double payout)", rejections.length === 1);
    const walletAfterConcurrent = await api("GET", "/api/daily-streak", { token: userA.token });
    check("wallet shows only +15 once (135 -> 150), not +30", walletAfterConcurrent.body.wallet.ves === 150);

    console.log("\n=== SECTION 11: Idempotency key replay ===");
    await rewindCycleBy(userA.userId, 25);
    const idemKey = "api-test-key-abc123";
    const firstIdem = await api("POST", "/api/daily-streak/claim", { token: userA.token, body: { day: 4, idempotencyKey: idemKey } });
    check("Day 4 claimed with idempotency key", firstIdem.status === 201 && firstIdem.body.claim.day === 4);
    const replayIdem = await api("POST", "/api/daily-streak/claim", { token: userA.token, body: { day: 4, idempotencyKey: idemKey } });
    check("replay with same key returns idempotent:true, same claimId", replayIdem.status === 200 && replayIdem.body.idempotent === true && replayIdem.body.claim.claimId === firstIdem.body.claim.claimId);
    const walletAfterReplay = await api("GET", "/api/daily-streak", { token: userA.token });
    check("wallet credited the gift card only once (giftCardInr = 1)", walletAfterReplay.body.wallet.giftCardInr === 1);

    console.log("\n=== SECTION 12: Missed-day streak reset (PDF #49, #103) ===");
    await rewindCycleBy(userA.userId, 49); // past the 24h claim window + 24h grace
    const missedClaim = await api("POST", "/api/daily-streak/claim", { token: userA.token, body: { day: 5 } });
    check("claim after missing the window rejected: STREAK_RESET", missedClaim.status === 409 && missedClaim.body.code === "STREAK_RESET");
    const afterReset = await api("GET", "/api/daily-streak", { token: userA.token });
    check("status is RESET", afterReset.body.streak.status === "RESET");
    check("current day is back to 1", afterReset.body.streak.currentDay === 1);
    check("currentStreak reset to 0", afterReset.body.streak.currentStreak === 0);
    check("Day 1 is AVAILABLE again", afterReset.body.rewards[0].status === "AVAILABLE");
    check("missed Day 5 is marked MISSED", afterReset.body.rewards[4].status === "MISSED");

    console.log("\n=== SECTION 13: Refresh / re-fetch after reset shows the same state (PDF #53) ===");
    const refetch = await api("GET", "/api/daily-streak", { token: userA.token });
    check("fetching again shows the SAME reset state, not re-randomized", refetch.body.streak.status === "RESET" && refetch.body.streak.currentDay === 1);

    console.log("\n=== SECTION 14: History endpoint ===");
    const history = await api("GET", "/api/daily-streak/history?page=1&limit=20", { token: userA.token });
    check("history returns 4 completed claims for userA (days 1,2,3,4)", history.body.total === 4);

    console.log("\n=== SECTION 15: Validation rejects garbage input ===");
    const badDay = await api("POST", "/api/daily-streak/claim", { token: userA.token, body: { day: "not-a-number" } });
    check("non-numeric day rejected with VALIDATION_ERROR", badDay.status === 400 && badDay.body.code === "VALIDATION_ERROR");
  } finally {
    if (userA) await cleanupUser(userA.userId);
    if (userB) await cleanupUser(userB.userId);
    await mongoose.disconnect();
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("API test failed:", err.message);
  process.exit(1);
});