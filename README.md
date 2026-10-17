# 🇰🇪 KenyaPay — Multi-Rail Payment & Payout Platform

A production-grade, **standalone payment disbursement and collection system** for Kenya.

[![Built with](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express%20%2B%20Prisma-339933?logo=node.js)](https://nodejs.org)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite%20%2B%20Tailwind-61DAFB?logo=react)](https://react.dev)
[![Mobile](https://img.shields.io/badge/Mobile-React%20Native%20%2B%20Expo-000020?logo=expo)](https://expo.dev)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%28Supabase%29-3ECF8E?logo=supabase)](https://supabase.com)

---

## 🏗️ Architecture

```
kenyan-payment-platform/
├── backend/          # Node.js + Express + Prisma + BullMQ
├── frontend/         # React 18 + Vite + Tailwind + shadcn/ui
└── mobile/           # React Native + Expo (APK)
```

## 💳 Payment Rails Supported

| Rail | Description | Limit |
|------|-------------|-------|
| **M-Pesa B2C** | Direct to personal phone | KES 70,000 |
| **M-Pesa B2B Paybill** | Business Paybill payments | KES 999,999 |
| **M-Pesa Buy Goods Till** | Till number payments | KES 999,999 |
| **PesaLink** | Real-time interbank (KEPSS) | KES 999,999 |
| **RTGS / EFT** | Large value transfers (CBK) | Unlimited |
| **Equity Jenga API** | Equity Bank Open API | Per agreement |
| **KCB Open Banking** | KCB Bank API | Per agreement |

## 🔐 Security & Compliance

- **Maker → Checker → Director** approval chain — funds never leave without final director sign-off
- **AES-256** encryption for all API credentials at rest
- **JWT + Refresh Token** rotation with secure HttpOnly cookies
- **TOTP 2FA** (Google Authenticator, Authy)
- **Biometric login** on Android (fingerprint / face unlock)
- **Full audit trail** — every action timestamped and logged
- **IP whitelist** and session timeout controls

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL (via Supabase)
- Redis (local or Upstash)

### 1. Backend

```bash
cd backend
cp .env.example .env
# Fill in your Supabase DB password, JWT secrets, etc.

npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed

npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

### 3. Mobile (Android APK)

```bash
cd mobile
npm install

# Run on device/emulator
npx expo run:android

# Build APK (requires EAS account)
npm install -g eas-cli
eas login
eas build --platform android --profile apk
```

## 🗄️ Database (Supabase)

**Project:** `gwvtuhveefgalhabnjqa.supabase.co`

Update `backend/.env`:
```env
DATABASE_URL="postgresql://postgres:[YOUR_DB_PASSWORD]@db.gwvtuhveefgalhabnjqa.supabase.co:5432/postgres"
```

## 👤 Default Credentials (after seed)

| Email | Password | Role |
|-------|----------|------|
| `superadmin@kenyapay.co.ke` | `SuperAdmin123!` | Super Admin |
| `admin@acme.co.ke` | `OrgAdmin123!` | Org Admin |
| `maker@acme.co.ke` | `Maker123!` | Maker |
| `checker@acme.co.ke` | `Checker123!` | Checker |
| `director@acme.co.ke` | `Director123!` | Director |
| `finance@acme.co.ke` | `Finance123!` | Finance |

> ⚠️ Change all passwords immediately after first login!

## 📱 Mobile App Features

- 🔐 Biometric login (fingerprint / face ID)
- 📊 Real-time dashboard with wallet balances
- 💸 New payments via all 6 rails
- ✅ Checker approval queue
- 🛡️ Director sign-off with PIN
- 🔔 Push notifications
- 📋 Payment history and filters
- 💼 Wallet ledger view

## 🏢 Web Dashboard Pages

| Page | Description |
|------|-------------|
| Dashboard | KPI cards, charts, recent transactions |
| Payments | Full payment list with filters, bulk actions, CSV export |
| New Payment | Multi-rail payment creation wizard |
| Payment Detail | Timeline, approval workflow, ledger entries |
| Approvals | Checker queue with inline approve/reject |
| Director Sign-off | Director authorization with legal notice |
| Wallets | Multi-wallet management with ledger |
| Suppliers | Beneficiary profiles with payment history & statements |
| Users | Team management with role-based invitations |
| Organization | Company profile, directors, payment rails, limits |
| API Credentials | Per-rail encrypted credential management with test |
| System Activation | Activation code entry and status |
| Settings | General, security, approval workflow, localization |
| Reports | Analytics charts with date range filters |
| Reconciliation | Match system vs bank/M-Pesa records |
| Audit Trail | Full tamper-evident log with filters |
| Profile | 2FA setup, password change, notification prefs |

## 🔧 Environment Variables

See `backend/.env.example` for all required variables including:
- `DATABASE_URL` — Supabase PostgreSQL
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `ENCRYPTION_KEY` — AES-256 for API credentials
- `MPESA_*` — Safaricom Daraja API
- `SMTP_*` — Email (any SMTP)
- `AT_*` — Africa's Talking SMS

## 📄 License

Proprietary — All rights reserved © KenyaPay 2026
