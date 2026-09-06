# 🚚 Courier & Logistics Management Platform — Backend

A production-ready, backend-only REST API for a courier and parcel delivery platform — the kind of system that powers services like Pathao Courier, RedX, or Steadfast. Customers book shipments, riders deliver them, and admins run the whole operation.

Built with **Node.js, TypeScript, Express, PostgreSQL, Prisma, Redis, and bKash** for real payments.

---

## 📖 Table of Contents

- [Problem & Solution](#-problem--solution)
- [Tech Stack](#-tech-stack)
- [Roles & Permissions](#-roles--permissions)
- [Core Workflow](#-core-workflow)
- [Feature List](#-feature-list)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Database Schema](#-database-schema)
- [API Reference](#-api-reference)
- [Testing With Postman](#-testing-with-postman)
- [Project Structure](#-project-structure)
- [Design Decisions & Challenges](#-design-decisions--challenges)

---

## 🎯 Problem & Solution

Bangladesh's e-commerce and F-commerce boom depends heavily on courier services (Pathao, RedX, Steadfast, eCourier) to move parcels from sellers to buyers. This project models that exact domain: a customer books a shipment between two hubs, an admin assigns a verified rider, and the rider carries the parcel through pickup → transit → delivery, with full tracking history and real online payment for the delivery fee.

The same core logic (pickup → hub → transfer → delivery, role-based access, payment reconciliation) applies globally — it's the same shape used by FedEx, DHL, and UPS.

---

## 🛠️ Tech Stack

| Category | Technology |
|---|---|
| Runtime & Framework | Node.js, TypeScript, Express.js 5 |
| Database & ORM | PostgreSQL + Prisma 7 (via `@prisma/adapter-pg`) |
| Validation | Zod |
| Auth | JWT (access + refresh), bcrypt password hashing, Google Sign-In |
| Caching / OTP store | Redis |
| File storage | Multer + Cloudinary |
| Payments | bKash Tokenized Checkout (sandbox) |
| Email | Nodemailer (Gmail SMTP) + EJS templates |
| Security | Helmet, express-rate-limit, CORS |
| Scheduled jobs | node-cron |
| Linting/Formatting | Biome |

---

## 👤 Roles & Permissions

The platform has **3 primary roles** (plus `SUPER_ADMIN`, which is a bootstrap-level admin with the same permissions as `ADMIN`):

| Role | Can do |
|---|---|
| **Customer** | Register/login, create shipments, view/track their own shipments, pay the delivery fee via bKash, cancel a shipment before pickup |
| **Rider** | Apply to become a rider (requires admin approval), view shipments assigned to them, update shipment status as they progress, view earnings |
| **Admin** (`ADMIN` / `SUPER_ADMIN`) | Approve/reject rider applications, manage hubs, assign riders to shipments, view all shipments & payments, refund payments, view dashboard analytics & audit logs, manage user status |

A role can never access another role's protected endpoints — every protected route is guarded by `auth(...allowedRoles)` middleware, and returns `403 Forbidden` otherwise.

---

## 🔄 Core Workflow

```
Customer creates Shipment (PENDING)
        │
        ▼
Admin assigns an approved Rider  →  ASSIGNED
        │
        ▼
Rider marks Picked Up            →  PICKED_UP
        │
        ▼
Rider marks In Transit           →  IN_TRANSIT
        │
        ▼
Rider marks Out For Delivery     →  OUT_FOR_DELIVERY
        │
        ├──► Delivered successfully →  DELIVERED  (COD auto-marked PAID; rider stats updated)
        │
        └──► Delivery failed        →  FAILED     (can be re-assigned or marked RETURNED)

Customer can CANCEL a shipment any time before it's picked up.
Every status change is recorded as an immutable TrackingEvent (used for public tracking + admin audit logs).
```

---

## ✅ Feature List

**Authentication & Authorization**
- Email/password registration with OTP email verification (Redis-backed, 5-minute expiry)
- Separate rider application flow — a rider registers with vehicle & NID details, verifies their email, then waits for **admin approval** before they can receive shipments
- Google Sign-In for customers
- JWT access + refresh tokens (httpOnly cookies + Bearer header support)
- Forgot/reset password via OTP, change password, logout
- Strict role-based middleware on every protected route

**User & Rider Management**
- Profile view/update, profile image upload (Cloudinary)
- Admin: list/search/filter users, block/unblock accounts
- Admin: list/search/filter rider applications, approve/reject with a reason (triggers an email either way)
- Rider: update vehicle/zone/availability, view assigned shipments, view earnings summary

**Hubs**
- Admin CRUD for hubs (name, zone, address), soft delete guarded against hubs with active shipments

**Shipments (core business logic)**
- Create shipment with computed delivery fee (base fee + per-kg + per-km)
- COD or prepaid delivery fee
- Admin assigns an available, approved rider (optimistic-concurrency safe — two admins can't double-assign the same parcel)
- Rider-driven status transitions with a strict allowed-transition map (no skipping steps, no going backwards)
- Customer cancellation (only before pickup)
- Public tracking by tracking code — no login required
- Full tracking timeline per shipment + ability to add manual notes
- Admin: paginated/filterable/searchable shipment list; soft delete

**Payments (bKash)**
- Real bKash Tokenized Checkout integration: create → redirect → execute → callback → status update
- Refund flow for admins
- COD shipments are automatically marked `PAID` on successful delivery

**Admin Analytics**
- Dashboard stats (shipment counts by status, revenue, rider counts by verification status, etc.)
- Customer and rider self-analytics
- Audit log endpoint (backed by the `TrackingEvent` table)

**Data & API quality**
- Consistent `{ success, message, data }` / `{ success, message, errors }` response shape everywhere
- Zod validation on every mutating endpoint
- Pagination, filtering, sorting, and search on all list endpoints
- Soft deletes (`isDeleted` + `deletedAt`) on Customer, Rider, Hub, Shipment — nothing is hard-deleted
- Database transactions for every multi-step write (shipment creation, assignment, status updates, cancellation)
- Indexes on all frequently-queried columns

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Redis
- A Cloudinary account (free tier is fine)
- A Gmail account with an [App Password](https://myaccount.google.com/apppasswords) for SMTP
- A bKash **sandbox** merchant account ([bKash Developer Portal](https://developer.bka.sh/))

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in every value in `.env` — see [Environment Variables](#-environment-variables) below for what each one is for.

### 3. Generate the Prisma client & run migrations

```bash
npx prisma generate
npx prisma migrate dev --name init
```

This creates all tables (`users`, `customers`, `riders`, `hubs`, `shipments`, `tracking_events`, `payments`) in your database.

### 4. Run the server

```bash
npm run dev
```

On first boot the server automatically seeds:
- 1 Super Admin, 1 Admin, 1 approved Rider, 1 Customer (credentials from your `.env`)
- 5 hubs across Dhaka, Chattogram, Khulna, and Sylhet

The API is now live at `http://localhost:5000`, and the health-check route is:

```
GET /
# {"success":true,"message":"Welcome to the Courier & Logistics Management Platform API"}
```

### 5. Build for production

```bash
npm run build
npm start
```

---

## 🔑 Environment Variables

All variables are documented with example values in [`.env.example`](./.env.example). Key groups:

| Group | Variables |
|---|---|
| App | `NODE_ENV`, `PORT`, `APP_URL`, `FRONTEND_URL` |
| Database | `DATABASE_URL` |
| Auth | `BCRYPT_SALT_ROUNDS`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `GOOGLE_CLIENT_ID` |
| Seed accounts | `SUPER_ADMIN_*`, `TESTER_ADMIN_*`, `TESTER_RIDER_*`, `TESTER_CUSTOMER_*` |
| Redis | `REDIS_USER`, `REDIS_PASSWORD`, `REDIS_HOST`, `REDIS_PORT` |
| Email | `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_SENDER` |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| bKash | `BKASH_BASE_URL`, `BKASH_USERNAME`, `BKASH_PASSWORD`, `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_CALLBACK_URL` |
| Pricing | `BASE_DELIVERY_FEE`, `PER_KM_FEE`, `PER_KG_FEE` |

> ⚠️ Never commit your real `.env`. Only `.env.example` (with placeholder values) is tracked in git.

---

## 🗄️ Database Schema

```
User (base account: email, password, role, status)
 ├── 1:1 → Customer (name, contact, address)
 │           └── 1:N → Shipment (as customer)
 └── 1:1 → Rider (vehicle, NID, verificationStatus, zone, rating)
             └── 1:N → Shipment (as rider)

Hub (name, zone, address)
 ├── 1:N → Shipment (as originHub)
 └── 1:N → Shipment (as destinationHub)

Shipment (trackingCode, status, parcel details, pricing)
 ├── 1:N → TrackingEvent (immutable status history / audit trail)
 └── 1:1 → Payment (bKash / COD payment record)
```

Full schema lives in [`prisma/schema/`](./prisma/schema), split by domain (`user.prisma`, `customer.prisma`, `rider.prisma`, `hub.prisma`, `shipment.prisma`, `trackingEvent.prisma`, `payment.prisma`, `enums.prisma`).

---

## 📡 API Reference

All routes are versioned under `/api/v1`. Full request/response examples are in the Postman collection (see below). Summary:

```
# Auth
POST   /api/v1/auth/register                Customer registration (sends OTP)
POST   /api/v1/auth/verify-email            Verify customer email + OTP -> creates account, logs in
POST   /api/v1/auth/register-rider          Rider application (sends OTP)
POST   /api/v1/auth/verify-rider-email      Verify rider email + OTP -> account pending admin approval
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh-token
POST   /api/v1/auth/google
GET    /api/v1/auth/me
POST   /api/v1/auth/change-password
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password

# Users
PATCH  /api/v1/users/profile-image
PATCH  /api/v1/users/me
GET    /api/v1/users                        (admin) ?page&limit&role&status&searchTerm
GET    /api/v1/users/:id                    (admin)
PATCH  /api/v1/users/:id/status             (admin) block/unblock

# Riders
GET    /api/v1/riders/me                    (rider)
PATCH  /api/v1/riders/me                    (rider)
GET    /api/v1/riders/me/assigned-shipments (rider) ?page&limit&status
GET    /api/v1/riders/me/earnings           (rider)
GET    /api/v1/riders                       (admin) ?verificationStatus&zone&isAvailable&searchTerm
GET    /api/v1/riders/:id                   (admin)
PATCH  /api/v1/riders/:id/verify            (admin) approve/reject

# Hubs
POST   /api/v1/hubs                         (admin)
GET    /api/v1/hubs                         (public) ?zone&isActive&searchTerm
GET    /api/v1/hubs/:id                     (public)
PATCH  /api/v1/hubs/:id                     (admin)
DELETE /api/v1/hubs/:id                     (admin) soft delete

# Shipments
POST   /api/v1/shipments                    (customer)
GET    /api/v1/shipments/my-shipments       (customer) ?page&limit&status
GET    /api/v1/shipments                    (admin) ?page&limit&status&riderId&customerId&searchTerm
GET    /api/v1/shipments/:id                (customer/rider: own only, admin: any)
GET    /api/v1/shipments/track/:trackingCode  (public -- no auth)
PATCH  /api/v1/shipments/:id/assign         (admin)
PATCH  /api/v1/shipments/:id/status         (rider/admin)
PATCH  /api/v1/shipments/:id/cancel         (customer)
DELETE /api/v1/shipments/:id                (admin) soft delete

# Tracking
GET    /api/v1/tracking/:shipmentId
POST   /api/v1/tracking/:shipmentId/note    (rider/admin)

# Payments
POST   /api/v1/payments/initiate            (customer) -> returns bKash checkout URL
GET    /api/v1/payments/callback            (public -- bKash redirects here)
POST   /api/v1/payments/refund              (admin)
GET    /api/v1/payments/my-payments         (customer)
GET    /api/v1/payments/all-payments        (admin)
GET    /api/v1/payments/:shipmentId

# Analytics
GET    /api/v1/analytics/dashboard-stats    (admin)
GET    /api/v1/analytics/audit-logs         (admin)
GET    /api/v1/analytics/customer-analytics (customer)
GET    /api/v1/analytics/rider-analytics    (rider)
```

**Response shape (every endpoint):**

```json
// success
{ "success": true, "message": "Operation successful", "data": {} }

// error
{ "success": false, "message": "Something went wrong", "errors": [] }
```

---

## 🧪 Testing With Postman

1. Import [`Courier-Logistics-Platform.postman_collection.json`](./Courier-Logistics-Platform.postman_collection.json) into Postman.
2. Set the collection variable `baseUrl` to your running server (default `http://localhost:5000/api/v1`).
3. Log in as the seeded Admin/Rider/Customer accounts (from your `.env`) using the `Auth` folder — the collection auto-saves the returned `accessToken` into the `accessToken` collection variable via a test script, so every subsequent request is authenticated automatically.
4. Walk through the folders in order: **Auth → Hubs → Shipments → Assign/Status → Payments → Analytics** to see the full lifecycle.

### Demo flow for the walkthrough video
1. Login as Customer → create a shipment between two hubs.
2. Login as Admin → view the pending shipment → approve a pending rider (if needed) → assign the rider.
3. Login as Rider → move the shipment through `PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED`.
4. As Customer → initiate a bKash payment for a different (unpaid) shipment → complete it in the bKash sandbox → show the callback updating payment status.
5. Show a `403` when a Customer tries to hit a Rider/Admin-only route, and a `404`/validation `400` on bad input.
6. As Admin → show `/analytics/dashboard-stats` and `/analytics/audit-logs`.

---

## 📁 Project Structure

```
src/
├── app.ts                     # Express app: middleware, routes, error handling
├── server.ts                  # Bootstraps DB/Redis/mail, seeds data, starts the server
└── app/
    ├── config/                # Typed env config
    ├── interfaces/            # Shared query/interface types
    ├── lib/                   # prisma, redis, cloudinary, multer, nodemailer, bkash, cron, googleAuth
    ├── middleware/             # auth (RBAC), validateRequest, globalErrorHandler, notFound
    ├── templates/              # EJS email templates
    ├── utils/                  # AppError, catchAsync, sendResponse, jwt, seed, queryHelper
    └── module/
        ├── auth/
        ├── user/
        ├── rider/
        ├── hub/
        ├── shipment/
        ├── tracking/
        ├── payment/
        └── analytics/
            each with: *.controller.ts, *.service.ts, *.route.ts, *.validation.ts, *.interface.ts

prisma/
└── schema/                    # user, customer, rider, hub, shipment, trackingEvent, payment, enums
```

---

## 🧩 Design Decisions & Challenges

- **Optimistic concurrency on shipment status.** Two admins assigning the same `PENDING` shipment to two different riders at the same instant is a real race condition. Every status-changing write uses `updateMany({ where: { id, status: <expected current status> } })` inside a Prisma transaction — if the row already moved, the update matches zero rows and the request fails with `409 Conflict` instead of silently overwriting another admin's action.
- **Strict status-transition map.** A shipment can't jump from `PENDING` straight to `DELIVERED`, and it can't go backwards. `STATUS_TRANSITIONS` in `shipment.service.ts` is the single source of truth for what's allowed next.
- **Rider verification mirrors a real courier company's onboarding.** A rider can't just sign up and start receiving parcels — they submit vehicle/NID details, verify their email, and then an admin has to approve them before `isAvailable` even matters. Rejection requires a reason and emails the applicant.
- **bKash + COD both flow through one `Payment` model.** A COD shipment gets its `Payment` row created automatically (status `PAID`) the moment it's marked `DELIVERED`, so `GET /payments/:shipmentId` and the analytics revenue numbers work the same way regardless of payment method.
- **Every module follows the same five-file shape** (`controller / service / route / validation / interface`) that the original codebase established, so the API surface is predictable and easy to extend (e.g. adding a `Fleet` or `Notification` module later is a copy-paste-adapt job, not a redesign).
