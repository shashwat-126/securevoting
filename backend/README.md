# 🗳️ SecureVote — Production-Grade Secure Voting System

A high-security, production-style voting platform built with Node.js, Express, PostgreSQL, and advanced cryptographic techniques like public-key encryption and Shamir Secret Sharing.

🔗 **Live Demo:** https://securevoting.onrender.com
📦 **Repository:** https://github.com/shashwat-126/securevoting

---

## 🚀 Overview

SecureVote simulates a real-world election system with strong guarantees:

* 🔐 Votes are encrypted at submission
* 📊 No candidate-wise results visible during voting
* 📉 Only participation % shown during active election
* 🧠 Results decrypted only after election ends
* 🧩 Requires multi-party key reconstruction (Shamir Secret Sharing)
* ⚖️ Supports tie detection (no false winner)

---

## 🔐 Key Features

### 🧑‍💼 Admin Panel

* Admin authentication
* Create/manage elections
* Add candidates
* Start/stop elections
* Submit key shares
* Decrypt results
* View audit logs

### 🗳️ Voting System

* Secure vote casting
* Anonymous voting (no voter linkage)
* Encrypted vote storage

### 🔐 Security Features

* Public-key encryption (RSA)
* Shamir Secret Sharing (2-of-3 key reconstruction)
* JWT-based authentication
* Rate limiting
* Helmet security headers
* CORS protection
* Audit logging system

---

## 🧠 System Architecture

```
Frontend (HTML/CSS/JS)
        ↓
Backend (Node.js + Express)
        ↓
PostgreSQL (Render)
        ↓
Crypto Layer
  ├── RSA Encryption
  └── Shamir Secret Sharing
```

---

## 📁 Project Structure

```
secure-voting/
├── frontend/              # Static frontend (admin + voting UI)
├── src/
│   ├── controllers/      # Business logic
│   ├── routes/           # API routes
│   ├── middleware/       # Auth, rate limit, audit
│   ├── services/         # Crypto + Shamir logic
│   ├── config/           # DB + logger config
│   └── app.js            # Express app setup
│
├── scripts/              # Migration scripts
├── database.sql          # PostgreSQL schema
├── server.js             # Entry point
├── .env.example          # Env template
├── render.yaml           # Render deployment config
└── README.md
```

---

## ⚙️ LOCAL DEVELOPMENT SETUP

### 1️⃣ Clone the repo

```bash
git clone https://github.com/shashwat-126/securevoting.git
cd securevoting
```

### 2️⃣ Install dependencies

```bash
npm install
```

### 3️⃣ Setup PostgreSQL locally

Create DB:

```bash
createdb voting_db
```

Import schema:

```bash
psql -U postgres -d voting_db -f database.sql
```

### 4️⃣ Setup environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```
NODE_ENV=development
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=voting_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_SSL=false

JWT_ADMIN_SECRET=generate_random
JWT_VOTER_SECRET=generate_random

ALLOWED_ORIGINS=http://localhost:3000
```

### 5️⃣ Run the server

```bash
npm start
```

### 6️⃣ Access app

* http://localhost:3000/admin.html
* http://localhost:3000/index.html

---

## ☁️ PRODUCTION DEPLOYMENT (Render)

### 🧱 Services Used

* Render Web Service (Backend + Frontend)
* Render PostgreSQL (Database)

### 1️⃣ Create PostgreSQL on Render

* Go to Render → New → Postgres
* Copy credentials

### 2️⃣ Import schema

```bash
psql "postgresql://USER:PASSWORD@HOST:5432/DB_NAME?sslmode=require" -f database.sql
```

### 3️⃣ Deploy Web Service

* New → Web Service
* Connect GitHub repo

**Build Command:**

```bash
npm install
```

**Start Command:**

```bash
npm start
```

### 4️⃣ Add Environment Variables (IMPORTANT)

```
NODE_ENV=production
PORT=10000

DB_HOST=YOUR_RENDER_HOST
DB_PORT=5432
DB_NAME=YOUR_DB
DB_USER=YOUR_USER
DB_PASSWORD=YOUR_PASSWORD
DB_SSL=true

JWT_ADMIN_SECRET=strong_random_secret
JWT_VOTER_SECRET=strong_random_secret

ALLOWED_ORIGINS=https://securevoting.onrender.com
```

### 5️⃣ Access live app

* https://securevoting.onrender.com/admin.html

---

## ⚖️ Tie Handling Logic

If multiple candidates have equal highest votes:

* ❌ No single winner
* ✅ All marked as Tie
* ✅ `winner = null`
* ✅ UI shows ⚖️ Tie badge

---

## 🔐 Security Best Practices

* No secrets committed to GitHub
* `.env` excluded via `.gitignore`
* Database credentials stored in Render
* Votes encrypted at rest
* Private key never persisted permanently
* Rate limiting on auth endpoints
* CORS restricted to trusted origins

---

## 📊 API Overview

```
POST   /api/v1/auth/admin/login
POST   /api/v1/admin/elections
POST   /api/v1/admin/elections/:id/candidates
PATCH  /api/v1/admin/elections/:id/status
POST   /api/v1/admin/elections/:id/shares
GET    /api/v1/admin/elections/:id/results
GET    /api/v1/admin/audit
```

---

## 🚀 Future Enhancements

* Blockchain-based vote verification
* Zero-Knowledge Proof voting
* Multi-region deployment
* Real-time analytics dashboard
* AI fraud detection


---

## ⭐ Final Note

This project demonstrates:

* 🔐 Cryptographic system design
* 🧱 Backend architecture
* ☁️ Cloud deployment
* ⚙️ CI/CD readiness
* 📊 Real-world problem solving

---


## ⚠️ IMPORTANT

* Rotate secrets before production
* Never expose DB credentials
* Use HTTPS-only origins in production

---

## 🧑‍💻 Author

**Shashwat**
