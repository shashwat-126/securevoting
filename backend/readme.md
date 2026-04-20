#  SecureVote —  Secure E Voting Platform

A production-grade, security-first digital voting system designed with **zero-trust principles**, **end-to-end encryption**, and **high availability** in mind.

This system ensures:

*  Voter privacy (no intermediate result leakage)
*  Cryptographic integrity (RSA + Shamir Secret Sharing)
*  Fair elections (results only after closure + delay)
*  Transparent auditing (audit logs for all actions)

---

#  Live Deployment

* **Backend (Render):**
  https://securevoting.onrender.com/

* **Frontend (Firebase):**
  https://evoting-76d.web.app/

* **Admin Panel:**
  https://evoting-76d.web.app/admin.html

---

#  Core Features

##  Voter System

* Secure registration & login
* Vote casting with encrypted payloads
* Real-time participation percentage (no result leakage)
* One-vote-per-user enforcement

##  Admin System

* Election creation & scheduling
* Candidate management
* Election lifecycle control (pending → active → ended)
* Secure result decryption using key shares
* Audit log visibility

##  Security Model

* RSA-based vote encryption
* Shamir Secret Sharing (3 shares, 2 required)
* Private key destroyed after split
* Reconstructed only post-election
* JWT-based authentication (separate voter/admin secrets)
* Rate limiting + CORS protection

##  Result Control

* No candidate-wise visibility during voting
* Only participation % visible
* Results automatically available **30 minutes after election ends**

---

#  System Architecture

```text
Frontend (Firebase Hosting)
        ↓
Backend API (Render - Node.js/Express)
        ↓
Database (Neon PostgreSQL)
```

---

#  Tech Stack

* **Frontend:** HTML, CSS, JavaScript (Vanilla)
* **Backend:** Node.js, Express
* **Database:** PostgreSQL (Neon)
* **Auth:** JWT
* **Security:** bcrypt, RSA, Shamir Secret Sharing
* **Deployment:** Render + Firebase
* **Process Manager (Dev):** PM2

---

#  Development Setup

## 1. Clone & Setup

```bash
git clone <repo-url>
cd securevoting/backend
npm install
```

## 2. Environment Setup

Create `.env`:

```env
PORT=3000
DATABASE_URL=your_local_db_url

JWT_VOTER_SECRET=your_secret
JWT_ADMIN_SECRET=your_secret

ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@test.com
ADMIN_PASSWORD=StrongPassword123!
```

---

## 3. Initialize Database

```bash
node scripts/migrate.js
```

---

## 4. Run with PM2 (Development)

```bash
npm install -g pm2
pm2 start server.js --name securevote-dev
pm2 logs
```

### Useful PM2 Commands

```bash
pm2 restart securevote-dev
pm2 stop securevote-dev
pm2 delete securevote-dev
```

---

#  Production Setup

## Backend (Render)

* Root Directory: `backend`
* Build Command: `npm install`
* Start Command: `node server.js`

### Required Environment Variables

```env
NODE_ENV=production
PORT=10000

DATABASE_URL=your_neon_url

JWT_VOTER_SECRET=...
JWT_ADMIN_SECRET=...

ALLOWED_ORIGINS=https://evoting-76d.web.app
```

---

## Frontend (Firebase)

```bash
cd backend/frontend
firebase deploy
```

---

#  Admin Initialization

Admin is created using:

```bash
NODE_ENV=production node scripts/migrate.js
```

After creation, remove:

```env
ADMIN_PASSWORD=...
```

---

#  Election Flow

1. Admin logs in
2. Creates election
3. Adds candidates
4. Starts election
5. Voters register & vote
6. Admin ends election
7. Key shares submitted
8. Results decrypted after delay

---

#  Audit & Transparency

Every critical action is logged:

* login attempts
* vote casting
* election changes
* result decryption

---

#  Security Considerations

* Never expose `.env` files
* Use strong JWT secrets (64-byte hex)
* Enforce HTTPS (handled via Render/Firebase)
* Use secure cookies in future upgrades

---

#  Future Improvements

*  Secure cookie-based auth (HTTP-only)
*  Dockerized microservices
*  Real-time monitoring dashboard
*  CI/CD pipeline
*  AI-based fraud detection
*  Multi-region deployment

---


#  Summary

SecureVote is a **production-ready, security-focused voting platform** that demonstrates:

* distributed system design
* applied cryptography
* full-stack engineering
* real-world deployment

---
#  Author

Shashwat



