# Security Documentation

## Principle

The frontend never decides a streak value, reward amount, claim eligibility,
or timer. Every one of these is calculated server-side from MongoDB and
server time, and independently re-verified on every request.

## Defenses by attack type

| Attack (PDF ref) | Defense |
|---|---|
| DevTools streak edit (#96) | React state is a display mirror only; a fresh `GET /api/daily-streak` always overwrites it with server truth |
| Fake reward/amount in request (#98) | Claim endpoint never reads `reward`/`amount`/`currency` from the body; reward is looked up from `StreakReward` by the server-calculated day |
| Fake `userId` (#100) | Identity comes only from the verified JWT (`req.user`), never the request body |
| Device clock change (#97) | All timers (`nextClaimAt`, `expiresAt`) are stored absolute UTC timestamps calculated from server time; compared again against server time on every claim |
| Day jump, e.g. `{day:7}` (#99) | Server independently calculates `expectedDay` from `cycle.lastClaimedDay`; a mismatched `day` is rejected with `INVALID_DAY` |
| Duplicate claim (#101) | Unique MongoDB index on `(userId, cycleId, day)`; also blocked by the transaction's conditional `findOneAndUpdate` |
| Concurrent claims (#102) | The transaction's `findOneAndUpdate` only matches if `lastClaimedDay` still equals the expected prior value — a losing concurrent request matches nothing and is rejected |
| Cross-user claim (#45, #100) | Every query is scoped to `req.user._id`; there is no code path that accepts a target user ID |
| Missed-day non-reset | `checkMissedDay()` compares server time to the stored `expiresAt` on every status/claim request, independent of frontend activity |
| Browser closed / tab closed (#51) | Reset logic runs server-side on the next request, not on any frontend lifecycle event |
| Multiple tabs (#52) | Both tabs hit the same backend state; the second claim fails the same conditional update check |

## Authentication

- Passwords hashed with bcrypt (12 rounds)
- JWT, HS256, 7-day expiry (configurable)
- Timing-safe login: a dummy bcrypt comparison runs even for unknown emails, so
  login response time doesn't reveal which emails are registered
- `protect` middleware verifies the JWT and reloads the user from the DB on
  every request (so a disabled account is blocked immediately, not just until
  token expiry)

## Rate limiting

- Auth endpoints: 20 requests / 15 min per IP (production)
- Claim endpoint: 10 requests / minute per authenticated user
- General streak reads: 60 requests / minute per authenticated user

## Input validation

All request bodies validated with `express-validator` before reaching any
controller logic. Invalid input never reaches the database layer.

## Error handling

Raw database errors (`MongoServerError`, `CastError`) and stack traces are
never sent to the client. `errorHandler` middleware catches everything and
returns a generic `SERVER_ERROR` message, logging the real error server-side only.

## Idempotency

Clients may send an `idempotencyKey` with a claim request. A repeated request
with the same key returns the original result instead of erroring or
double-paying — handles network retries and double-taps safely.