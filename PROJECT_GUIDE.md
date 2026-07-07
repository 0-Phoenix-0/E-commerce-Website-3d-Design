# E-Commerce Platform — Project Guide

> This is the single source of truth for the entire project. Every architectural decision, convention, and workflow is documented here. Do not repeat information documented in this file.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture](#3-architecture)
4. [Folder Structure](#4-folder-structure)
5. [Docker Overview](#5-docker-overview)
6. [Environment Variables](#6-environment-variables)
7. [Database Overview](#7-database-overview)
8. [Authentication Overview](#8-authentication-overview)
9. [API Design](#9-api-design)
10. [Coding Standards](#10-coding-standards)
11. [Naming Conventions](#11-naming-conventions)
12. [UI / UX Standards](#12-ui--ux-standards)
13. [Responsive Strategy](#13-responsive-strategy)
14. [Security Overview](#14-security-overview)
15. [Performance Guidelines](#15-performance-guidelines)
16. [Development Workflow](#16-development-workflow)
17. [Git Workflow](#17-git-workflow)
18. [Deployment Overview](#18-deployment-overview)
19. [Milestone Roadmap](#19-milestone-roadmap)
20. [Feature Reference](#20-feature-reference)

---

## 1. Project Overview

A production-ready, full-stack E-Commerce Platform built for real-world deployment. The platform supports two roles — **Customer** and **Admin** — with a complete shopping experience including product browsing, cart, checkout, order tracking, and an admin dashboard for store management.

This is not a demo project. Every decision prioritizes security, maintainability, scalability, and professional quality.

---

## 2. Technology Stack

### Frontend
| Technology | Version | Reason |
|---|---|---|
| Next.js | 15 (App Router) | Production-grade React framework with SSR, SSG, routing |
| TypeScript | 5.x | Type safety, better DX, fewer runtime bugs |
| Tailwind CSS | 4.x | Utility-first styling — fast, consistent, maintainable |

### Backend
| Technology | Version | Reason |
|---|---|---|
| Node.js | 22 LTS | Stable, performant JS runtime |
| Express.js | 5.x | Minimal, flexible REST API framework |

### Database
| Technology | Reason |
|---|---|
| MongoDB | Flexible schema suits e-commerce product variance |
| Mongoose | ODM providing schema validation, middleware, and type safety |

### Authentication
| Technology | Reason |
|---|---|
| JWT | Stateless auth — no server-side session storage needed |
| bcrypt | Industry-standard password hashing with salt rounds |

### Storage
| Technology | Reason |
|---|---|
| Cloudinary | Managed image CDN with transformation API — no self-hosted storage |

### Infrastructure
| Technology | Reason |
|---|---|
| Docker | Reproducible dev environments, parity between dev and prod |
| Docker Compose | Orchestrate frontend, backend, and MongoDB as a single stack |

### Package Manager
| Tool | Reason |
|---|---|
| npm | Consistent lockfile, widely supported in CI/CD pipelines |

---

## 3. Architecture

```
Browser
  │
  ▼
Next.js Frontend  (Port 3000)
  │
  │  REST API calls (HTTP/JSON)
  ▼
Express Backend   (Port 5000)
  │
  ├──▶ MongoDB     (Port 27017)
  │
  └──▶ Cloudinary  (External CDN)
```

**Key Rules:**
- Frontend and backend are completely separate services.
- Next.js does **not** contain any API routes for business logic.
- The Express backend is the only source of truth for all data mutations and reads.
- Frontend communicates with the backend exclusively through REST API calls.
- JWT tokens are stored in `httpOnly` cookies (not `localStorage`).

---

## 4. Folder Structure

```
/                             ← Repository root
├── docker-compose.yml
├── .env.example
├── PROJECT_GUIDE.md
│
├── frontend/                 ← Next.js 15 App
│   ├── Dockerfile
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── app/              ← Next.js App Router pages
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   ├── (auth)/
│       │   │   ├── login/
│       │   │   └── register/
│       │   ├── (shop)/
│       │   │   ├── products/
│       │   │   ├── products/[slug]/
│       │   │   ├── cart/
│       │   │   ├── checkout/
│       │   │   ├── orders/
│       │   │   └── wishlist/
│       │   └── admin/
│       │       ├── layout.tsx
│       │       ├── page.tsx
│       │       ├── products/
│       │       ├── categories/
│       │       ├── orders/
│       │       └── inventory/
│       ├── components/       ← Shared, reusable UI components
│       ├── lib/              ← API client, auth helpers, utilities
│       ├── hooks/            ← Only hooks with real reuse across pages
│       ├── types/            ← Shared TypeScript types/interfaces
│       └── middleware.ts     ← Route protection
│
└── backend/                  ← Express.js API
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts          ← Server entry point
        ├── config/           ← DB connection, Cloudinary, env validation
        ├── middleware/       ← auth, error handler, validation
        ├── models/           ← Mongoose schemas
        ├── routes/           ← Express route definitions
        └── controllers/      ← Route handler logic
```

**Rules:**
- Every file must have a real, singular purpose.
- Before creating a new file, ask: can an existing file be extended?
- No barrel `index.ts` files unless the module is imported from 5+ places.
- No utility folders created speculatively — only when a utility is actually shared.

---

## 5. Docker Overview

### Services

| Service | Image | Port |
|---|---|---|
| `frontend` | Custom (Node 22 Alpine) | 3000 |
| `backend` | Custom (Node 22 Alpine) | 5000 |
| `mongo` | `mongo:7` | 27017 |

### `docker-compose.yml` Strategy

- `frontend` and `backend` both use multi-stage Dockerfiles (dev stage for local, prod stage for deployment).
- MongoDB data is persisted via a named Docker volume (`mongo_data`).
- All secrets are injected via environment variables — never hardcoded in any Dockerfile or source file.
- Services communicate over Docker's internal network by service name (e.g., `http://backend:5000`).
- Health checks are defined for `mongo` so dependent services wait correctly.

### Development vs Production

- In development, source code is mounted as a volume so hot reload works without rebuilding images.
- In production, images are built with compiled output only — no source maps, no dev dependencies.

---

## 6. Environment Variables

### Root `.env` (used by Docker Compose)

```env
# MongoDB
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=strongpassword

# Backend
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://admin:strongpassword@mongo:27017/ecommerce?authSource=admin
JWT_SECRET=replace_with_256bit_random_secret
JWT_EXPIRES_IN=7d
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLIENT_ORIGIN=http://localhost:3000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

**Rules:**
- `.env` is gitignored.
- `.env.example` is committed with placeholder values only.
- `NEXT_PUBLIC_*` variables are the only ones safe to expose to the browser.
- Backend validates all required env vars at startup and crashes fast if any are missing.

---

## 7. Database Overview

### Collections

| Collection | Purpose |
|---|---|
| `users` | Authentication, roles, profile |
| `categories` | Product categorization (hierarchical) |
| `products` | Product catalog with variants |
| `orders` | Customer orders with line items |
| `carts` | Persistent cart per user |
| `wishlists` | User wishlist (product references) |

### Schema Design Principles

- Use `ObjectId` references (`.populate()`) only when the referenced document is queried independently.
- Embed sub-documents (e.g., order line items) when data is only ever accessed as part of the parent.
- All schemas include `createdAt` and `updatedAt` via Mongoose `timestamps: true`.
- All monetary values are stored in **cents (integers)** to avoid floating-point rounding errors.
- Indexes are defined on fields used in queries: `email` (unique), `slug` (unique), `category`, `createdAt`.

### Soft Deletes

Products and categories use a `isDeleted: boolean` field rather than hard deletion to preserve order history integrity.

---

## 8. Authentication Overview

### Flow

```
1. User submits credentials (email + password)
2. Backend verifies password with bcrypt.compare()
3. On success: sign JWT { userId, role } with JWT_SECRET
4. Return JWT in httpOnly, Secure, SameSite=Strict cookie
5. All subsequent API requests include the cookie automatically
6. Protected routes call authMiddleware which verifies the JWT
7. Role-based middleware (requireAdmin) checks user.role === 'admin'
```

### JWT Payload

```json
{
  "userId": "ObjectId",
  "role": "customer | admin",
  "iat": 0,
  "exp": 0
}
```

### Security Rules

- Passwords are hashed with `bcrypt` at **12 salt rounds**.
- JWT is stored in `httpOnly` cookie — inaccessible to JavaScript (XSS-proof).
- Cookie is `Secure` in production, `SameSite=Strict` always.
- JWT secret is minimum 256-bit random value — never a human-readable string.
- Token expiry is 7 days; no refresh token for now (simple scope).
- Password is never returned in any API response (`select: false` on schema).

### Roles

| Role | Access |
|---|---|
| `customer` | Shop, cart, checkout, orders, wishlist, profile |
| `admin` | All customer access + full admin dashboard |

---

## 9. API Design

### Base URL

```
/api/v1
```

### Conventions

- RESTful resource-based URLs.
- HTTP verbs: `GET` (read), `POST` (create), `PUT` (full update), `PATCH` (partial update), `DELETE`.
- All responses follow a consistent envelope:

```json
{
  "success": true,
  "data": { },
  "message": "Optional human-readable message"
}
```

```json
{
  "success": false,
  "message": "Error description",
  "errors": [ ]
}
```

- Pagination uses `?page=1&limit=20` query params; response includes `total`, `page`, `pages`.
- All IDs in URLs are MongoDB ObjectIds.

### Route Groups

| Prefix | Resource |
|---|---|
| `/api/v1/auth` | Register, login, logout, me |
| `/api/v1/products` | Product CRUD + search/filter |
| `/api/v1/categories` | Category CRUD |
| `/api/v1/cart` | Cart management |
| `/api/v1/wishlist` | Wishlist management |
| `/api/v1/orders` | Order creation, history, details |
| `/api/v1/admin/orders` | Admin order management |
| `/api/v1/admin/users` | Admin user overview |
| `/api/v1/upload` | Cloudinary image upload |

---

## 10. Coding Standards

### TypeScript

- `strict: true` in all `tsconfig.json` files.
- No `any` — use `unknown` and narrow, or define a proper type.
- Prefer `interface` for object shapes, `type` for unions/aliases.
- All async functions return typed Promises or use `async/await` with explicit return types.
- All Express handlers are typed with `Request`, `Response`, `NextFunction`.

### Functions

- Single responsibility — one function does one thing.
- Maximum function length: ~30 lines. Extract if longer.
- No deeply nested callbacks — prefer `async/await`.
- No commented-out code in committed files.

### Error Handling

- Backend: all errors flow through a centralized `errorHandler` Express middleware.
- A custom `AppError` class extends `Error` with `statusCode` and `isOperational`.
- Unhandled promise rejections crash the process (let Docker/PM2 restart it).
- Frontend: API errors surface as user-visible toast notifications — never `console.error` only.

### Imports

- No wildcard imports (`import * as`).
- Sort: external packages → internal `@/` aliases → relative paths.
- No unused imports — enforced by ESLint.

---

## 11. Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| Files (components) | PascalCase | `ProductCard.tsx` |
| Files (non-components) | camelCase | `authMiddleware.ts` |
| React components | PascalCase | `ProductCard` |
| Functions | camelCase | `getProductBySlug` |
| Variables | camelCase | `totalPrice` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_CART_ITEMS` |
| Types / Interfaces | PascalCase | `Product`, `OrderItem` |
| MongoDB collections | camelCase plural | `products`, `orderItems` |
| API routes | kebab-case | `/api/v1/product-reviews` |
| CSS classes | Tailwind utilities only | — |
| Environment variables | SCREAMING_SNAKE_CASE | `JWT_SECRET` |

---

## 12. UI / UX Standards

### Design Language

Inspired by Apple, Nike, Stripe, Samsung. Clean. Minimal. Professional. Trustworthy.

### Color Palette

| Role | Value |
|---|---|
| Background | `#ffffff` / `#f9f9f9` |
| Surface | `#f3f4f6` |
| Border | `#e5e7eb` |
| Text Primary | `#111827` |
| Text Secondary | `#6b7280` |
| Accent | `#2563eb` (Blue-600) |
| Accent Hover | `#1d4ed8` (Blue-700) |
| Danger | `#dc2626` |
| Success | `#16a34a` |

### Typography

- Font family: **Inter** (Google Fonts)
- Scale: Tailwind's default `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-4xl`
- Font weights: 400 (body), 500 (UI elements), 600 (headings), 700 (display)

### Spacing

- Consistent 4px grid (Tailwind's spacing scale).
- Page max-width: `max-w-7xl` centered with `mx-auto px-4 sm:px-6 lg:px-8`.

### Animations

- Transitions: `transition-colors duration-150` for hover states.
- No heavy animations. No bouncing. No spinning loaders for simple actions.
- Loading states use skeleton screens (gray shimmer), not spinners.

### Component Rules

- Buttons: two variants only — `primary` (solid blue) and `secondary` (outlined).
- Forms: consistent label-above-input layout, clear error states.
- Cards: subtle shadow (`shadow-sm`), rounded corners (`rounded-xl`).
- No glassmorphism. No gradients on content. No emoji.

---

## 13. Responsive Strategy

### Breakpoints (Tailwind defaults)

| Breakpoint | Min Width | Use |
|---|---|---|
| `sm` | 640px | Large phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Ultrawides |

### Rules

- Mobile-first: write base styles for mobile, add `sm:`, `md:`, `lg:` overrides.
- Product grids: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.
- Navigation: hamburger menu on mobile, full nav on desktop.
- Admin dashboard: sidebar collapses to icon-only on tablet, hidden on mobile with overlay.
- Every layout is tested at 375px (iPhone SE), 768px (iPad), 1440px (desktop), 1920px (ultrawide).
- Responsiveness is **never postponed**. Every page is built responsive from the start.

---

## 14. Security Overview

| Threat | Mitigation |
|---|---|
| Password brute force | bcrypt (12 rounds), rate limiting on `/api/v1/auth` |
| XSS | JWT in httpOnly cookie; no sensitive data in localStorage |
| CSRF | SameSite=Strict cookie attribute |
| SQL/NoSQL Injection | Mongoose schema validation; never raw query concatenation |
| Unauthorized access | `authMiddleware` on all protected routes; `requireAdmin` for admin routes |
| Sensitive data exposure | `password` field has `select: false`; no secrets in responses |
| Insecure env config | `dotenv` + startup validation; `.env` gitignored |
| CORS | Explicit allowlist via `CLIENT_ORIGIN` env var |
| Dependency vulnerabilities | `npm audit` in CI; keep dependencies updated |
| File upload abuse | Cloudinary handles file type validation; signed uploads only |

---

## 15. Performance Guidelines

### Backend

- Database queries use `.select()` to return only needed fields.
- Use `.lean()` for read-only queries (returns plain JS objects, not Mongoose documents).
- Paginate all list endpoints — never return unbounded arrays.
- Indexes on all frequently queried fields.
- Cloudinary uploads happen via signed SDK calls — never stream through the Express server.

### Frontend

- Use Next.js `Image` component for all images (automatic optimization, lazy loading, WebP).
- Products list uses server-side pagination — never load all at once.
- Skeleton screens shown during data fetching — no layout shift.
- Avoid `useEffect` for data fetching where server components can be used.
- No unnecessary client components — use `"use client"` only when browser APIs or interactivity is required.

---

## 16. Development Workflow

### Starting the Project

```bash
# Clone and start everything
git clone <repo>
cd ecommerce
cp .env.example .env
# Fill in .env values
docker compose up --build
```

### URLs

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000/api/v1 |
| MongoDB | mongodb://localhost:27017 |

### Hot Reload

- Frontend: Next.js Fast Refresh works via volume mount.
- Backend: `ts-node-dev` (or `tsx watch`) restarts on file change via volume mount.

### Adding Dependencies

```bash
# Frontend
docker compose exec frontend npm install <package>

# Backend
docker compose exec backend npm install <package>
```

---

## 17. Git Workflow

### Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Production-ready code only |
| `develop` | Integration branch |
| `feature/<name>` | Individual features |
| `fix/<name>` | Bug fixes |

### Commit Convention

Format: `type(scope): short description`

| Type | When |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Build, deps, config |
| `style` | Formatting only |
| `refactor` | Refactor without behavior change |
| `docs` | Documentation only |

Examples:
```
feat(auth): add JWT login endpoint
fix(cart): prevent negative quantity
chore(docker): update node base image to 22
```

### Rules

- Never commit directly to `main`.
- Each PR is reviewed before merging to `develop`.
- `main` is only updated from `develop` after full milestone testing.

---

## 18. Deployment Overview

### Target

- Frontend: Vercel (or any Node-capable host)
- Backend + MongoDB: VPS (DigitalOcean Droplet, AWS EC2, etc.) via Docker Compose
- Cloudinary: External managed CDN

### Production Checklist

- [ ] All `.env` values set in production environment
- [ ] `NODE_ENV=production` set
- [ ] JWT_SECRET is a strong 256-bit random value
- [ ] MongoDB running with authentication enabled
- [ ] CORS locked to production frontend domain
- [ ] Cookie `Secure: true` enforced
- [ ] HTTPS via reverse proxy (Nginx + Certbot)
- [ ] `npm audit` passes with no high/critical vulnerabilities
- [ ] Docker images built with production stage

### Nginx (Production Reverse Proxy)

```
Browser (HTTPS:443) → Nginx → backend:5000
                             → frontend:3000
```

Nginx handles SSL termination, HTTP→HTTPS redirect, and proxies to internal Docker services.

---

## 19. Milestone Roadmap

| Milestone | Scope | Status |
|---|---|---|
| **M1** | Project setup, Docker, env, Next.js, Express, MongoDB connection | 🔲 |
| **M2** | Authentication — register, login, logout, protected routes, role guard | 🔲 |
| **M3** | Admin Dashboard — categories CRUD, products CRUD, inventory, orders | 🔲 |
| **M4** | Customer Website — home, browse, product detail, search, filters | 🔲 |
| **M5** | Orders — cart, wishlist, checkout, order history | 🔲 |
| **M6** | Testing — API tests, component tests, E2E smoke tests | 🔲 |
| **M7** | Deployment preparation — production Docker, Nginx config, env audit | 🔲 |

---

## 20. Feature Reference

### Customer Features

| Feature | Route | Auth Required |
|---|---|---|
| Home / Landing | `/` | No |
| Browse by Category | `/products?category=slug` | No |
| Search Products | `/products?q=term` | No |
| Filter Products | `/products?minPrice=&maxPrice=&sort=` | No |
| Product Detail | `/products/[slug]` | No |
| Wishlist | `/wishlist` | Yes |
| Cart | `/cart` | Yes |
| Checkout | `/checkout` | Yes |
| Order History | `/orders` | Yes |
| User Profile | `/profile` | Yes |

### Admin Features

| Feature | Route | Role Required |
|---|---|---|
| Dashboard | `/admin` | admin |
| Category CRUD | `/admin/categories` | admin |
| Product CRUD | `/admin/products` | admin |
| Inventory | `/admin/inventory` | admin |
| Order Management | `/admin/orders` | admin |

---

*This document is the single source of truth. All decisions not documented here are engineering judgment calls by the implementing developer. When in doubt, refer to the principles in this guide: keep it simple, keep it secure, keep it clean.*
