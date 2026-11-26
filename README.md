# 🎁 Loyalty Rewards – Smart Customer Loyalty Platform

**Loyalty Rewards** is a MERN Stack web application that allows customers to earn loyalty points by claiming unique product codes printed inside product boxes. Customers can redeem points for rewards, while administrators manage products, batches, customers and redemptions.

## 🚀 Features

### Customer
- Register and login securely.
- Claim points using unique product codes.
- Scan QR codes to claim points.
- View points balance and transaction history.
- Browse and redeem rewards.
- Track redemption status.

### Admin
- Dashboard with customer and claim statistics.
- Generate unique product-code batches.
- Generate, print and export QR codes.
- Manage rewards and stock.
- Approve, fulfil or reject redemptions.
- Manage customer accounts.
- Monitor suspicious activities.

## 🛠️ Technology Stack

- **Frontend:** React.js, Vite, CSS
- **Backend:** Node.js, Express.js
- **Database:** MongoDB
- **Authentication:** JWT
- **Security:** Crypto hashing and rate limiting

## 🔐 Security Features

- Unique 60-bit product codes.
- Keyed checksum validation.
- Secure product-code hashing.
- Single-use code protection.
- Failed-attempt account locking.
- Daily claim limits and IP rate limiting.
- Admin account suspension and batch invalidation.

## 📂 Project Structure

```text
Loyalty-Rewards/
├── README.md
├── ASSUMPTIONS.md
├── ARCHITECTURE.md
├── AI_LOG.md
├── .env.example
├── docker-compose.yml
├── docs/
│   └── TEST_PLAN.md
├── server/
│   ├── src/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── lib/
│   │   └── scripts/
│   └── tests/
└── client/
    └── src/
        ├── components/
        └── pages/
            └── admin/
```

## ⚙️ Installation & Setup

**1. Clone the repository**

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd Loyalty-Rewards
```

**2. Start MongoDB**

```bash
docker compose up -d
```

**3. Configure environment variables**

```bash
cd server
cp ../.env.example .env
```

Add your MongoDB URI, JWT secret, code secret and admin credentials.

**4. Install and start the backend**

```bash
npm install
npm run seed
npm run dev
```

**5. Install and start the frontend**

Open another terminal:

```bash
cd client
npm install
npm run dev
```

**6. Open the application**

```text
Frontend: http://localhost:5173
Backend:  http://localhost:4000
```

## 🧪 Testing

Run backend tests:

```bash
cd server
npm test
```

**Reported result: 39 passing unit tests.**

Tests cover code validation, duplicate claims, security, redemptions, refunds and concurrent requests.

## 🗄️ Database Collections

- users
- batches
- codes
- ledgerentries
- rewards
- redemptions
- claimattempts

Database name: `loyalty`

## 🌐 Deployment

| Component | Platform |
|---|---|
| Frontend | Vercel / Netlify |
| Backend | Render / Railway |
| Database | MongoDB Atlas |

## 📚 Documentation

- [ASSUMPTIONS.md](ASSUMPTIONS.md) – Project assumptions.
- [ARCHITECTURE.md](ARCHITECTURE.md) – System architecture.
- [AI_LOG.md](AI_LOG.md) – AI usage and corrections.
- [TEST_PLAN.md](docs/TEST_PLAN.md) – Testing documentation.

---

**🎁 Loyalty Rewards – Every Box Has a Reward. Every Customer Matters.**