# Box Rewards – Customer Loyalty System

A loyalty-rewards web app for a factory that sells products in boxes. Each box carries a unique,
single-use code. Customers sign in, enter (or scan) the code to earn points, and exchange points for
rewards. The factory owner generates codes, manages the rewards catalogue, fulfils reward requests and
watches for fraud from one dashboard.

**Stack (MERN):** MongoDB · Express · React (Vite) · Node.js

## How it answers the three questions in the brief

| Question | Answer |
|---|---|
| **How does a customer prove they bought a product?** | Every box has a unique code printed inside (under the flap or a scratch panel). Knowing it proves possession of that physical box. The customer enters it (or scans a QR that opens `/claim?code=…`) while signed in. |
| **How are fraud and code reuse prevented?** | 60-bit random codes (not guessable) with a secret-keyed checksum · only a keyed hash is stored, never the code · a single atomic database update makes each code usable exactly once, even under simultaneous requests · 5 wrong attempts lock the account for 15 min · daily claim cap · per-IP rate limits · owner can suspend users and void whole batches. Details in [ARCHITECTURE.md](ARCHITECTURE.md). |
| **How does the owner view, manage and monitor?** | Owner dashboard: KPIs and claims chart, batch generation with CSV export for the printer, void batches, rewards catalogue and stock, redemption queue (fulfil/reject with automatic refund), customer list with suspend, and a Security tab (repeat failures, shared IPs, recent failed attempts). |

## Features

**Customer:** register / sign in · claim a code by typing it or scanning its QR · live points balance · rewards catalogue · request a reward · points history · request status.

**Owner (admin):** overview stats · generate code batches · print QR labels (up to 500) or download CSV (shown once) · void a batch · manage rewards & stock · fulfil or reject requests · suspend/reinstate customers · security monitoring.

## Repository layout

```
.
├── README.md  ASSUMPTIONS.md  ARCHITECTURE.md  AI_LOG.md
├── .env.example               # copy to server/.env  (placeholders only)
├── docker-compose.yml         # local MongoDB
├── docs/TEST_PLAN.md          # automated results + manual test checklist
├── server/
│   ├── package.json
│   ├── src/
│   │   ├── index.js           # boot: config -> Mongo -> Express
│   │   ├── app.js             # middleware + route wiring
│   │   ├── config.js          # env validation (fails fast on missing/weak secrets)
│   │   ├── repo.js            # MongoDB implementation of the data-access "deps"
│   │   ├── lib/               # codes.js (generate/verify/hash), rateLimit.js, errors.js, asyncHandler.js
│   │   ├── models/            # User, Batch, Code, LedgerEntry, Reward, Redemption, ClaimAttempt
│   │   ├── services/          # claimService, redemptionService, batchService  (business rules)
│   │   ├── routes/            # auth.js, customer.js, admin.js
│   │   ├── middleware/        # auth.js (JWT + role), error.js
│   │   └── scripts/seed.js    # creates owner account, sample rewards, demo codes
│   └── tests/                 # node:test unit tests + in-memory store (helpers/fakeStore.js)
└── client/
    ├── package.json  vite.config.js  index.html  vercel.json
    └── src/
        ├── main.jsx  App.jsx  api.js  auth.jsx  hooks.js  styles.css
        ├── components/        # Layout, AdminLayout, ui
        └── pages/             # Login, Customer, admin/{Overview,Batches,Rewards,Redemptions,Customers,Security}
```

## Run locally

Prerequisites: Node.js 20+ and MongoDB (local, `docker compose up -d`, or a free MongoDB Atlas URI).

```bash
# 1. Database (skip if you use Atlas)
docker compose up -d

# 2. Server
cd server
cp ../.env.example .env        # then edit: generate two different secrets (command is in the file)
npm install
npm run seed                   # creates the owner account, 3 rewards, and prints 10 demo codes
npm run dev                    # API on http://localhost:4000

# 3. Client (new terminal)
cd client
npm install
npm run dev                    # UI on http://localhost:5173
```

**Try it:** sign in as the owner (`ADMIN_EMAIL` / `ADMIN_PASSWORD` from your `.env`) → Batches & codes →
generate a batch → download the CSV. In a private window register a customer, paste a code and claim it;
paste the same code again to see it rejected. Then redeem a reward and fulfil it as the owner.

## Tests

```bash
cd server && npm test        # 39 tests, no database needed
```

The business rules (claiming, locking, redeeming, refunds, race conditions) are tested against an
in-memory store. Database-level behaviour and the UI are covered by the manual checklist in
[docs/TEST_PLAN.md](docs/TEST_PLAN.md).

## Configuration

All settings are environment variables – see [.env.example](.env.example). Never commit `server/.env`.
Fraud thresholds (`MAX_FAILED_CLAIMS`, `LOCK_MINUTES`, `MAX_CLAIMS_PER_DAY`) are tunable without code changes.

## Deploy (suggested, all free tiers)

- **Database:** MongoDB Atlas free cluster → copy the connection string into `MONGO_URI`.
- **API:** Render / Railway web service, root `server`, build `npm install`, start `npm start`. Set the
  env vars from `.env.example`, `TRUST_PROXY=true`, and `CLIENT_ORIGIN` to the client URL.
  Run `npm run seed` once from the service shell.
- **Client:** Vercel / Netlify, root `client`, build `npm run build`, output `dist`. Set
  `VITE_API_URL` to the API URL (no trailing slash). `vercel.json` handles SPA routing.

## Documentation

- [ASSUMPTIONS.md](ASSUMPTIONS.md) – every gap in the brief and the choice made
- [ARCHITECTURE.md](ARCHITECTURE.md) – stack reasons, data model, diagrams, fraud design
- [AI_LOG.md](AI_LOG.md) – how AI was directed and where it was wrong
- [docs/TEST_PLAN.md](docs/TEST_PLAN.md) – test results and manual checklist
