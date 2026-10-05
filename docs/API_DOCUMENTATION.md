# API Documentation

Base URL (local): `http://localhost:5000/api`

All Daily Streak endpoints require `Authorization: Bearer <token>`.

## Auth

### POST /auth/register
```json
// Request
{ "name": "Jane Doe", "email": "jane@example.com", "password": "Test1234" }

// Response 201
{
  "success": true,
  "token": "<jwt>",
  "user": { "id": "...", "name": "Jane Doe", "email": "jane@example.com", "role": "USER" },
  "wallet": { "ves": 120, "giftCardInr": 0 }
}
```

### POST /auth/login
```json
// Request
{ "email": "jane@example.com", "password": "Test1234" }

// Response 200 — same shape as register
```

### GET /auth/me
Requires auth. Returns `{ success, user, wallet, serverTime }`.

## Daily Streak

### GET /daily-streak
Full state for the page load.

```json
{
  "success": true,
  "serverTime": "2026-10-01T07:41:37.137Z",
  "streak": {
    "status": "NEW | ACTIVE | RESET",
    "currentStreak": 0,
    "currentDay": 1,
    "checkedIn": 0,
    "totalRewards": 7,
    "canClaim": true,
    "claimBlockedReason": null,
    "nextClaimAt": null,
    "secondsUntilNextClaim": 0,
    "cycleNumber": 1,
    "completedCycles": 0,
    "reset": null,
    "nextReward": { "day": 1, "rewardType": "VES", "amount": 5, "... "},
    "ultimateReward": { "day": 7, "status": "LOCKED", "amount": 5, "..." }
  },
  "rewards": [
    { "day": 1, "status": "AVAILABLE", "isToday": true, "reward": { "...": "..." } }
  ],
  "wallet": { "ves": 120, "giftCardInr": 0 }
}
```

### GET /daily-streak/status
Same response shape as above — a lighter-weight endpoint intended for polling
after the frontend's countdown visually reaches zero.

### POST /daily-streak/claim
```json
// Request body (both fields optional)
{ "day": 1, "idempotencyKey": "optional-client-generated-string" }

// Response 201 (new claim)
{
  "success": true,
  "idempotent": false,
  "claim": { "claimId": "...", "day": 1, "claimedAt": "...", "transactionId": "...", "referenceId": "STREAK-71ADB2B9" },
  "reward": { "rewardType": "VES", "currency": "VES", "amount": 5, "title": "Daily Reward" },
  "wallet": { "ves": 125, "giftCardInr": 0 }
}

// Response 200 (idempotent replay of an already-processed request)
{ "success": true, "idempotent": true, "claim": {...}, "reward": {...}, "wallet": {...} }
```

**Error responses** (all follow this shape):
```json
{ "success": false, "code": "ALREADY_CLAIMED", "message": "This reward has already been claimed." }
```

| Code | Status | Meaning |
|---|---|---|
| ALREADY_CLAIMED | 409 | That day was already claimed |
| STILL_LOCKED | 409 | Timer hasn't finished yet |
| INVALID_DAY | 400 | Requested day doesn't match the server-calculated eligible day |
| STREAK_RESET | 409 | The streak was just reset due to a missed window; re-fetch state |
| CYCLE_COMPLETE | 409 | All 7 days already claimed this cycle |
| ACCOUNT_DISABLED | 403 | User account is not active |
| UNAUTHENTICATED | 401 | Missing/invalid token |
| VALIDATION_ERROR | 400 | Malformed request body |
| RATE_LIMITED | 429 | Too many requests |

### GET /daily-streak/history?page=1&limit=20
```json
{
  "success": true,
  "page": 1,
  "limit": 20,
  "total": 4,
  "totalPages": 1,
  "history": [
    { "claimId": "...", "day": 1, "reward": {...}, "status": "COMPLETED", "claimedAt": "...", "transactionId": "..." }
  ]
}
```