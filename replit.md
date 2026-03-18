# Central Group Events (CGE) Website

## Overview

This is the official website for **Central Group Events (CGE)**, a nightlife event promotion agency covering North, Central, and South New Jersey. The site is a full-stack TypeScript monorepo with a React frontend (dark premium nightlife aesthetic) and an Express backend with PostgreSQL persistence.

Key features:
- Event calendar (searchable, region-filtered)
- Promotion booking form
- Newsletter subscription
- Full blog/newsletter system with subscriber gating, rich-text editing, comments, and analytics
- JWT-secured admin dashboard (events, bookings, blog posts, analytics, team management)

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend Architecture

- **Framework**: React 18 with TypeScript, bundled via Vite
- **Routing**: Wouter (lightweight client-side router)
  - Routes: `/`, `/booking-confirmation`, `/legal/terms`, `/legal/privacy`, `/admin`, `/blog`, `/blog/:slug`, `/faq`, `/welcome`, `/accept-invite`, `*` (404)
- **UI Components**: shadcn/ui (New York style) built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables; forced dark mode with purple (`--primary`) and gold (`--accent`) brand palette
- **Fonts**: Outfit (display) + Plus Jakarta Sans (body), via Google Fonts
- **Animations**: Framer Motion for scroll-triggered reveals
- **State / Data Fetching**: TanStack React Query v5
- **Forms**: React Hook Form + Zod resolvers
- **Rich Text Editor**: Tiptap (with StarterKit, Underline, Link, Heading extensions)

Key pages:
- `client/src/pages/Home.tsx` — All main sections (hero, services, events, pricing, booking, newsletter)
- `client/src/pages/Blog.tsx` — Blog listing with cover images, gating badges, newsletter CTA
- `client/src/pages/BlogPost.tsx` — Single post with rich text viewer, subscriber gating wall, comments
- `client/src/pages/FAQ.tsx` — Accordion FAQ page
- `client/src/pages/Welcome.tsx` — Subscriber welcome/redirect page
- `client/src/pages/AcceptInvite.tsx` — Admin invite acceptance (set password)
- `client/src/pages/Admin.tsx` — JWT-auth admin dashboard with 5 tabs
- `client/src/pages/legal/Terms.tsx` and `Privacy.tsx` — Legal pages
- `client/src/components/Navigation.tsx` — Fixed header with Blog/FAQ links via wouter Link
- `client/src/components/RichTextEditor.tsx` — Tiptap-based rich text editor + viewer

### Backend Architecture

- **Runtime**: Node.js with Express
- **Language**: TypeScript (tsx in dev, esbuild for production)
- **Server entry**: `server/index.ts`
- **Auth**: JWT in httpOnly cookie `cge_admin_jwt`; `requireAuth()` middleware in `server/auth.ts`
- **Routes**: `server/routes.ts`

Key API endpoints:
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/subscribers | — | Newsletter signup |
| POST | /api/bookings | — | Promotion booking |
| GET | /api/bookings | ✓ | All bookings (admin) |
| GET | /api/events | — | List events |
| POST | /api/events | ✓ | Create event |
| PUT | /api/events/:id | ✓ | Update event |
| DELETE | /api/events/:id | ✓ | Delete event |
| POST | /api/admin/login | — | Login → issues JWT cookie |
| POST | /api/admin/logout | — | Clears cookie |
| GET | /api/admin/me | ✓ | Current user info |
| POST | /api/admin/invite | ✓ | Invite team member (sends email) |
| POST | /api/admin/accept-invite | — | Set password from invite token |
| GET | /api/admin/team | ✓ | List admin users |
| POST | /api/admin/team/:id/deactivate | ✓ | Deactivate admin |
| POST | /api/admin/team/:id/reactivate | ✓ | Reactivate admin |
| GET | /api/admin/subscribers | ✓ | List newsletter subscribers |
| GET | /api/admin/analytics | ✓ | Per-post view/click analytics |
| POST | /api/admin/newsletter/send | ✓ | Blast email to all subscribers |
| GET | /api/posts | — | Published posts (no content/gated) |
| GET | /api/posts/admin | ✓ | All posts including drafts |
| GET | /api/posts/:slug | — | Single post (gated check) |
| POST | /api/posts | ✓ | Create post |
| PUT | /api/posts/:id | ✓ | Update post |
| DELETE | /api/posts/:id | ✓ | Delete post |
| POST | /api/posts/:id/publish | ✓ | Publish post |
| POST | /api/posts/:id/unpublish | ✓ | Unpublish post |
| GET | /api/posts/:id/versions | ✓ | Post version history |
| POST | /api/posts/:postId/restore/:versionId | ✓ | Restore version |
| POST | /api/subscriber/check | — | Check/register subscriber email |
| GET | /api/subscriber/verify | — | Verify cge_subscriber cookie |
| GET | /api/posts/:id/comments | — | Get comments |
| POST | /api/posts/:id/comments | sub | Post comment (requires cge_subscriber cookie) |
| GET | /go | — | Link tracking redirect |

### Database Schema (shared/schema.ts)

Tables:
- `newsletter_subscribers` — email, referrer, createdAt
- `promotion_bookings` — full booking form fields
- `events` — event listings
- `admin_users` — JWT auth users; role: superadmin/admin/editor
- `posts` — blog posts with isPublished, isGated, slug, content
- `post_versions` — content snapshots for versioning
- `post_views` — per-view tracking records
- `link_clicks` — outbound link click tracking
- `comments` — flat list with parentId for threading

### Admin Auth

- Superadmin credentials: `centralgroupevents@gmail.com` / `Cgevents2023`
- JWT issued as httpOnly cookie `cge_admin_jwt` on `/api/admin/login`
- Cookie cleared on `/api/admin/logout`
- Session persists across page refreshes (restored via `/api/admin/me`)
- Deactivated admins are rejected even with valid JWT

### Subscriber Gating

- `cge_subscriber` signed httpOnly cookie set after `/api/subscriber/check`
- `/api/subscriber/verify` returns `{access: boolean}` to check cookie
- Gated posts return 403 with `{gated: true}` and no `content` field for non-subscribers
- Gate wall on `/blog/:slug` — shows teaser + email form

---

## External Dependencies

- **Nodemailer** (Gmail SMTP): `GMAIL_USER`, `GMAIL_APP_PASSWORD` env vars
- **PostgreSQL**: `DATABASE_URL` env var
- **JWT**: signed with `SESSION_SECRET` env var
- **Google Fonts**: Outfit, Plus Jakarta Sans

## Key npm Packages

| Package | Purpose |
|---|---|
| `drizzle-orm` + `drizzle-kit` | ORM and migrations |
| `pg` | PostgreSQL driver |
| `express` | HTTP server |
| `jsonwebtoken` + `bcrypt` | JWT auth + password hashing |
| `helmet` | Security headers |
| `cors` | Cross-origin policy |
| `express-rate-limit` | Rate limiting |
| `nodemailer` | Email |
| `zod` + `drizzle-zod` | Schema validation |
| `@tanstack/react-query` | Data fetching |
| `react-hook-form` | Form state |
| `framer-motion` | Animations |
| `wouter` | Client-side routing |
| `shadcn/ui` + Radix UI | UI primitives |
| `@tiptap/react` + extensions | Rich text editor |
| `slugify` | Post slug generation |
