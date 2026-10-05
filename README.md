# VELoop Rewards — Daily Streak System

A full-stack MERN implementation of a backend-driven Daily Streak & Rewards
feature. The frontend only renders what the backend decides — every streak
value, timer, reward, and claim decision is calculated and validated on the
server.

## Architecture
React Frontend (Vite)
|
Express.js REST API
|
Node.js
|
MongoDB (Atlas)

**Core principle:** the frontend is never the source of truth. Current streak,
current day, claim eligibility, reward values, and the 24-hour timer are all
calculated server-side from stored data and server time — never from
anything the browser sends.

## Tech stack

- **Frontend:** React 19 (Vite), React Router, Axios, Bootstrap, CSS Modules, Lucide React
- **Backend:** Node.js, Express 5, Mongoose, JWT, bcryptjs, express-validator, express-rate-limit, helmet
- **Database:** MongoDB Atlas (replica set, used for multi-document transactions)

## Project structure
veloop-daily-streak/
├── backend/
│ ├── src/
│ │ ├── config/ # env + DB connection
│ │ ├── controllers/ # route handlers
│ │ ├── middleware/ # auth, rate limiting, error handling
│ │ ├── models/ # Mongoose schemas
│ │ ├── routes/ # Express routers
│ │ ├── services/ # business logic (streak, claim, auth, reward, audit)
│ │ ├── utils/ # ApiError, JWT helpers, ID generators
│ │ └── validators/ # express-validator rule sets
│ ├── seed/ # seed.js + test scripts (checkModels, checkStreak, checkClaim, apiTest)
│ └── docs/ # API_DOCUMENTATION.md, DATABASE.md, SECURITY.md, TESTING.md
├── frontend/
│ └── src/
│ ├── components/ # ProtectedRoute
│ ├── context/ # AuthContext
│ ├── pages/
│ │ ├── Login.jsx, Register.jsx
│ │ └── DailyStreak/ # all streak UI components
│ └── services/ # api.js, streakApi.js
├── postman/ # Postman collection
└── docs/ # (mirrors backend/docs for top-level visibility)

## Installation

### Prerequisites
- Node.js 18+
- A MongoDB Atlas cluster (free tier is enough) — **must be a replica set**, since the claim flow uses multi-document transactions

### Backend

```bash
cd backend
npm install
cp .env.example .env     # then fill in MONGO_URI, JWT_SECRET, CLIENT_URL
npm run seed              # populates the 7 reward days + streak config
npm run dev                # starts on http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env     # set VITE_API_URL to your backend's /api URL
npm run dev                # starts on http://localhost:5173
```

## Environment variables

**`backend/.env`**
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/veloop_streak?retryWrites=true&w=majority
JWT_SECRET=<a long random string>
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173

**`frontend/.env`**
VITE_API_URL=http://localhost:5000/api

## Database schema

See [`backend/docs/DATABASE.md`](backend/docs/DATABASE.md) for full model details.

Collections: `users`, `wallets`, `streakconfigs`, `streakrewards`, `streakcycles`,
`streakclaims`, `wallettransactions`, `auditlogs`.

## Streak logic summary

- Each 7-day run is a **StreakCycle**. A user has at most one `ACTIVE` cycle at
  a time (enforced by a unique partial MongoDB index).
- After each claim, `nextClaimAt = claimedAt + claimIntervalHours` (default
  24h) and `expiresAt = nextClaimAt + claimWindowHours` (default another 24h),
  both calculated server-side and stored in MongoDB — never trusted from the client.
- If the server time passes `expiresAt` before the next claim, the cycle is
  marked `RESET` and a new cycle starts at Day 1.
- All of this is config-driven via the `StreakConfig` collection, so changing
  the number of days or timer length requires no code changes.

## Claim logic summary

Every claim runs inside **one MongoDB transaction** that atomically:
1. Advances the cycle's `lastClaimedDay` (only if it still matches the
   expected previous state — this is what stops concurrent double-claims)
2. Credits the wallet
3. Writes a `WalletTransaction` ledger entry
4. Writes a `StreakClaim` record

See [`backend/docs/SECURITY.md`](backend/docs/SECURITY.md) for the full list of
attacks this defends against.

## Reward system

Reward values, types, currencies, and assets are stored in the
`StreakReward` collection and loaded via `npm run seed`. See the table in
[`backend/docs/DATABASE.md`](backend/docs/DATABASE.md).

| Day | Type | Amount | Asset |
|---|---|---|---|
| 1 | VES | 5 | coin |
| 2 | VES | 10 | coin |
| 3 | VES | 15 | coin |
| 4 | GIFT_CARD | ₹1 | gift-box |
| 5 | GIFT_CARD | ₹2 | gift-card |
| 6 | VES | 30 | coin |
| 7 | GIFT_CARD | ₹5 | crown (ultimate) |

## Wallet integration

Two wallet balances: `ves` (in-app currency) and `giftCardInr` (gift card
value in rupees). Every change is backed by a `WalletTransaction` ledger
entry with `balanceBefore`/`balanceAfter`, so the full history is auditable.

## Security

See [`backend/docs/SECURITY.md`](backend/docs/SECURITY.md) for the full
breakdown. In summary: all streak/claim decisions are calculated and
validated server-side from MongoDB and server time; the client can send a
`day` hint but it is always independently re-verified; identity comes only
from the JWT; duplicate and concurrent claims are blocked at the database
level via unique indexes and conditional atomic updates.

## API endpoints

See [`backend/docs/API_DOCUMENTATION.md`](backend/docs/API_DOCUMENTATION.md)
for full request/response examples.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/register | No | Create account, 120 VEs welcome bonus |
| POST | /api/auth/login | No | Log in |
| GET | /api/auth/me | Yes | Current user + wallet |
| GET | /api/daily-streak | Yes | Full streak state |
| GET | /api/daily-streak/status | Yes | Lightweight status poll |
| POST | /api/daily-streak/claim | Yes | Claim today's reward |
| GET | /api/daily-streak/history | Yes | Paginated claim history |

## Testing

See [`backend/docs/TESTING.md`](backend/docs/TESTING.md) for the full scenario
list (duplicate claims, concurrent claims, fake day/reward/user, missed-day
reset, timer manipulation, etc.). Automated test scripts:

```bash
cd backend
npm run check:models   # verifies all collections + indexes exist
npm run check:streak   # verifies streak logic (current day, missed-day, reset)
npm run check:claim    # verifies claim logic (duplicate, concurrent, idempotency)
npm run test:api       # full end-to-end test against the real HTTP API
```

To run `test:api`, the backend server must already be running in a separate
terminal (`npm run dev`).

## Deployment

- **Frontend:** Vercel
- **Backend:** Render
- **Database:** MongoDB Atlas

### Backend (Render)
1. Push the repo to GitHub.
2. Render → New → Web Service → connect the repo.
3. Root Directory: `backend`, Build: `npm install`, Start: `npm start`.
4. Add env vars: `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_URL`.

### Frontend (Vercel)
1. Vercel → Add New Project → import the repo.
2. Root Directory: `frontend` (Vite auto-detected).
3. Add env var: `VITE_API_URL` = `<your-render-backend-url>/api`.

### Final step
Update the backend's `CLIENT_URL` env var on Render to the live Vercel URL
and redeploy, so CORS allows the live frontend.

## Demo credentials

Create your own account via the Register page — no pre-seeded demo account
is shipped with the repository. Registration gives a 120 VEs welcome bonus
automatically.

## Known limitations

- The CPA/advertisement step is a polished placeholder only (per project
  spec) — no real ad network is integrated. The VELoop team will integrate
  the real CPA solution later, as noted in the project brief.
- Reward image assets are emoji placeholders (`🪙`, `🎁`, `💳`, `👑`); swap
  them for real artwork/animations in
  `frontend/src/pages/DailyStreak/rewardAssets.js` without touching any
  other component.
- Rate limiting uses in-memory storage (`express-rate-limit` default), which
  resets on server restart and doesn't share state across multiple server
  instances. For multi-instance production deployment, swap in a Redis store.
- Tablet layout (768–1023px) is an interpolation between the supplied mobile
  and desktop designs, since no dedicated tablet reference was provided.

## License

Internal project submission — not licensed for external distribution.
