# Database Documentation

MongoDB Atlas (replica set required for transactions). Database name: `veloop_streak`.

## Collections

### `users`
| Field | Type | Notes |
|---|---|---|
| name | String | 2–60 chars |
| email | String | unique, lowercase |
| passwordHash | String | bcrypt, 12 rounds, never returned by default (`select: false`) |
| role | String | `USER` or `ADMIN`, always `USER` on registration regardless of client input |
| isActive | Boolean | false blocks login and claims |

### `wallets`
| Field | Type | Notes |
|---|---|---|
| userId | ObjectId | unique, ref `User` |
| ves | Number | in-app currency balance |
| giftCardInr | Number | gift card value in ₹ |

### `streakconfigs`
Single active document (`key: "default"`) controlling all streak rules:
`totalDays`, `claimIntervalHours`, `claimWindowHours`, `resetOnMiss`.

### `streakrewards`
One document per day (unique on `day`):

| Day | Type | Amount | Asset |
|---|---|---|---|
| 1 | VES | 5 | coin |
| 2 | VES | 10 | coin |
| 3 | VES | 15 | coin |
| 4 | GIFT_CARD | ₹1 | gift-box |
| 5 | GIFT_CARD | ₹2 | gift-card |
| 6 | VES | 30 | coin |
| 7 | GIFT_CARD | ₹5 | crown (ultimate) |

### `streakcycles`
One document per 7-day run. **Unique partial index** on `{ userId: 1 }` where
`status: "ACTIVE"` — guarantees a user can never have two active cycles, even
under concurrent requests. Statuses: `ACTIVE`, `COMPLETED`, `RESET`.

### `streakclaims`
One document per successful claim. **Unique index** on
`{ userId, cycleId, day }` — the core defense against duplicate claims at the
database level, not just application logic. Also has a unique partial index
on `{ userId, idempotencyKey }` for safe request retries.

### `wallettransactions`
Immutable ledger. Every balance change has `balanceBefore`/`balanceAfter`,
`referenceId` (e.g. `STREAK-71ADB2B9`), and links back to its `claimId`.

### `auditlogs`
Append-only event log: `STREAK_CLAIM_REQUEST`, `STREAK_CLAIM_SUCCESS`,
`STREAK_CLAIM_REJECTED`, `STREAK_RESET`, `DUPLICATE_CLAIM`, `INVALID_CLAIM`,
`USER_REGISTERED`, `USER_LOGIN`, `USER_LOGIN_FAILED`.

## Key indexes (security-relevant)

| Collection | Index | Purpose |
|---|---|---|
| streakcycles | `{userId:1}` unique, partial on `status:"ACTIVE"` | One active cycle per user |
| streakclaims | `{userId:1, cycleId:1, day:1}` unique | Blocks duplicate claims at the DB level |
| streakclaims | `{userId:1, idempotencyKey:1}` unique partial | Safe request retries |
| users | `{email:1}` unique | Prevents duplicate accounts |