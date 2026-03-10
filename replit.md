# Central Group Events (CGE) Website

## Overview

This is the official website for **Central Group Events (CGE)**, a nightlife event promotion company. The site serves as a marketing and lead-generation platform where venues and event organizers can:

- Browse upcoming events by region
- Submit promotion booking requests
- Sign up for the CGE newsletter
- Learn about CGE's services and pricing

The application is a full-stack TypeScript monorepo with a React frontend (dark premium nightlife aesthetic) and an Express backend with PostgreSQL persistence.

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend Architecture

- **Framework**: React 18 with TypeScript, bundled via Vite
- **Routing**: Wouter (lightweight client-side router)
  - Routes: `/` (Home), `/booking-confirmation` (post-form redirect), `/legal/terms`, `/legal/privacy`, `/admin` (password-protected dashboard), `*` (404)
- **UI Components**: shadcn/ui (New York style) built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming; forced dark mode with a purple (`--primary`) and gold (`--accent`) brand palette
- **Fonts**: Outfit (display) + Plus Jakarta Sans (body), loaded via Google Fonts
- **Animations**: Framer Motion for scroll-triggered reveals and micro-interactions
- **State / Data Fetching**: TanStack React Query v5 with a typed API contract from `shared/routes.ts`
- **Forms**: React Hook Form + Zod resolvers

Key pages:
- `client/src/pages/Home.tsx` — All main sections (hero, services, events, pricing, process, social CTA, booking form, newsletter)
- `client/src/pages/legal/Terms.tsx` and `Privacy.tsx` — Legal pages
- `client/src/hooks/use-landing.ts` — Custom hooks for events, newsletter, and booking mutations, all validated against the shared Zod API contract

### Backend Architecture

- **Runtime**: Node.js with Express
- **Language**: TypeScript (run via `tsx` in dev, compiled with esbuild for production)
- **Server entry**: `server/index.ts` — sets up Helmet, CORS (production restricted to `centralgroupevents.com`), JSON body parsing, and registers routes
- **Routes**: `server/routes.ts`
  - `POST /api/subscribers` — newsletter signup with rate limiting and Nodemailer notification
  - `POST /api/bookings` — promotion booking request with input validation, DB insert, and Nodemailer notification (includes mode, eventName, eventTime, city, eventTypeOther)
  - `GET /api/bookings` — returns all promotion submissions (for admin dashboard)
  - `GET /api/events` — list events, optionally filtered by region
- **Rate Limiting**: `express-rate-limit` — 10 requests per 15 minutes on form endpoints
- **Input Validation**: `express-validator` on booking fields + Zod parsing on both routes (via shared schema)
- **Static Serving**: In production, `server/static.ts` serves the Vite-built client from `dist/public` with SPA fallback

### Shared Code (`shared/`)

- **`shared/schema.ts`**: Drizzle ORM table definitions and Zod insert schemas for:
  - `newsletter_subscribers` (id, name, email, region, createdAt)
  - `promotion_bookings` (id, mode, eventName, venueName, contactName, phone, email, eventDate, eventTime, city, region, eventType, eventTypeOther, budgetRange, instagramHandle, readyToMoveForward, createdAt) — contactName/phone/budgetRange nullable; mode = "Standard" | "Premium"
  - `events` (id, title, description, date, region, city, imageUrl, ticketLink, createdAt)
- **`shared/routes.ts`**: Typed API contract (method, path, input schema, response schemas) consumed by both the backend and frontend hooks — single source of truth

### Data Storage

- **Database**: PostgreSQL via `drizzle-orm/node-postgres`
- **ORM**: Drizzle ORM with `drizzle-kit` for migrations (`./migrations` directory, schema from `shared/schema.ts`)
- **Connection**: `DATABASE_URL` environment variable required
- **Storage abstraction**: `server/storage.ts` defines an `IStorage` interface implemented by `DatabaseStorage` — easy to swap implementations

### Build System

- **Dev**: `tsx server/index.ts` with Vite middleware (`server/vite.ts`) for HMR
- **Production build**: `script/build.ts` runs Vite (client → `dist/public`) then esbuild (server → `dist/index.cjs`)
  - Server deps in an allowlist are bundled to reduce cold-start syscalls; all others are externalized

---

## External Dependencies

### Email / Notifications
- **Nodemailer** with Gmail SMTP transport
  - Required env vars: `GMAIL_USER`, `GMAIL_APP_PASSWORD`
  - Used for: new booking alerts and newsletter signup notifications sent to `centralgroupevents@gmail.com`

### Database
- **PostgreSQL** (any provider) — connection string via `DATABASE_URL` env var
- `connect-pg-simple` is included (for session storage if needed in the future)

### CDN / Fonts
- **Google Fonts** — Outfit, Plus Jakarta Sans (loaded in `client/index.html` and `index.css`)

### Social / External Links
- **Instagram**: `https://www.instagram.com/centralgroupevents/` — linked in Navigation and Social section

### Key npm Packages
| Package | Purpose |
|---|---|
| `drizzle-orm` + `drizzle-kit` | ORM and migrations |
| `pg` | PostgreSQL driver |
| `express` | HTTP server |
| `helmet` | Security headers |
| `cors` | Cross-origin policy |
| `express-rate-limit` | Form submission rate limiting |
| `express-validator` | Server-side input validation |
| `nodemailer` | Email notifications |
| `zod` + `drizzle-zod` | Schema validation (shared) |
| `@tanstack/react-query` | Client data fetching/caching |
| `react-hook-form` | Form state management |
| `framer-motion` | Animations |
| `wouter` | Client-side routing |
| `shadcn/ui` + Radix UI | Accessible UI primitives |
| `tailwind-merge` + `clsx` | Class name utilities |