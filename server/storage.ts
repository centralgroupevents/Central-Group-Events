import { db } from "./db";
import {
  newsletterSubscribers,
  promotionBookings,
  events,
  adminUsers,
  posts,
  postVersions,
  postViews,
  linkClicks,
  funnelEvents,
  scheduledEmailSends,
  appSettings,
  emailBlasts,
  emailBlastEvents,
  worldCupSubmissions,
  nbaFinalsSubmissions,
  landingPageSubmissions,
  pageRedirects,
  comments,
  pages,
  type InsertSubscriber,
  type Subscriber,
  type InsertBooking,
  type Booking,
  type InsertEvent,
  type Event,
  type AdminUser,
  type InsertAdminUser,
  type Post,
  type InsertPost,
  type PostVersion,
  type Comment,
  type InsertComment,
  type Page,
  type InsertPage,
  type WorldCupSubmission,
  type InsertWorldCupSubmission,
  type NbaFinalsSubmission,
  type InsertNbaFinalsSubmission,
  type LandingPageSubmission,
  type InsertLandingPageSubmission,
} from "@shared/schema";
import { eq, desc, sql, count, and, isNull, gte, lt, inArray } from "drizzle-orm";
import slugifyLib from "slugify";
import { regionSection, normalizeRegion } from "@shared/region";

// In-process slug→page cache. Every /:slug request hits getPageBySlug() twice
// (once from SSR meta lookup, once from the React render). Caching for 5 min
// keeps the DB free of repeated identical reads. Invalidated on upsert/delete.
const PAGE_CACHE_TTL_MS = 5 * 60 * 1000;
const pageCache = new Map<string, { page: Page | null; expiresAt: number }>();

function stageTimestampField(status: string): "contactedAt" | "paidAt" | "completedAt" | null {
  if (status === "Contacted") return "contactedAt";
  if (status === "Paid") return "paidAt";
  if (status === "Completed") return "completedAt";
  return null;
}

// ─── Slug helper ──────────────────────────────────────────────────────────

async function makeUniqueSlug(title: string, excludeId?: number): Promise<string> {
  const base = slugifyLib(title, { lower: true, strict: true });
  let slug = base;
  let i = 2;
  while (true) {
    const query = db.select().from(posts).where(eq(posts.slug, slug));
    const existing = await query;
    if (existing.length === 0 || (excludeId && existing[0]?.id === excludeId)) {
      return slug;
    }
    slug = `${base}-${i}`;
    i++;
  }
}

// ─── Storage interface ────────────────────────────────────────────────────

export interface IStorage {
  // Subscribers (newsletter + blog gating)
  createSubscriber(subscriber: InsertSubscriber): Promise<Subscriber>;
  findSubscriberByEmail(email: string): Promise<Subscriber | null>;
  upsertSubscriber(email: string, referrer?: string, name?: string): Promise<{ subscriber: Subscriber; isNew: boolean }>;

  importSubscribers(rows: Array<{ email: string; name?: string; region?: string; referrer?: string }>): Promise<{ imported: number; skipped: number }>;
  deleteSubscriber(id: number): Promise<void>;
  bulkDeleteSubscribers(ids: number[]): Promise<number>;
  bulkEditSubscribers(ids: number[], fields: { region?: string | null; referrer?: string | null }): Promise<number>;

  // Bookings
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBookings(): Promise<Booking[]>;
  updateBookingStatus(id: number, status: string): Promise<Booking | undefined>;
  bulkUpdateBookingStatus(ids: number[], status: string): Promise<number>;
  updateBookingNotes(id: number, adminNotes: string): Promise<Booking | undefined>;
  batchDeleteBookings(ids: number[]): Promise<void>;
  getStuckBookings(hoursOld: number): Promise<Booking[]>;

  // Events
  getEvents(region?: string, includePast?: boolean): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, event: Partial<InsertEvent>): Promise<Event>;
  deleteEvent(id: number): Promise<void>;
  bulkDeleteEvents(ids: number[]): Promise<void>;
  bulkImportEvents(
    rows: InsertEvent[],
  ): Promise<{ imported: number; duplicates: { title: string; existingId: number; existingDate: string }[] }>;

  // Pages
  getPageBySlug(slug: string): Promise<Page | null>;
  upsertPage(slug: string, data: Partial<InsertPage>): Promise<Page>;
  listPages(): Promise<Page[]>;
  listPublishedLandingPages(): Promise<Page[]>;
  deletePage(slug: string): Promise<boolean>;
  getPageById(id: number): Promise<Page | null>;
  duplicatePage(sourceSlug: string): Promise<Page | null>;
  incrementPageViewCount(slug: string): Promise<void>;
  renamePageSlug(currentSlug: string, newSlug: string): Promise<Page | null>;
  getPageRedirect(oldSlug: string): Promise<string | null>;

  // Admin users
  createAdminUser(data: Partial<InsertAdminUser>): Promise<AdminUser>;
  findAdminByEmail(email: string): Promise<AdminUser | null>;
  findAdminById(id: number): Promise<AdminUser | null>;
  findAdminByToken(token: string): Promise<AdminUser | null>;
  listAdminUsers(): Promise<Omit<AdminUser, "passwordHash">[]>;
  updateAdminUser(id: number, data: Partial<AdminUser>): Promise<AdminUser>;
  deactivateAdmin(id: number): Promise<void>;
  reactivateAdmin(id: number): Promise<void>;
  countAdminUsers(): Promise<number>;
  listSubscribers(): Promise<Subscriber[]>;

  // Posts
  createPost(data: Partial<InsertPost> & { title: string }): Promise<Post>;
  getPublishedPosts(): Promise<Partial<Post>[]>;
  getAllPosts(): Promise<Post[]>;
  getPostBySlug(slug: string): Promise<Post | null>;
  getPostById(id: number): Promise<Post | null>;
  updatePost(id: number, data: Partial<InsertPost>, savedBy?: number): Promise<Post>;
  deletePost(id: number): Promise<void>;
  togglePublish(id: number): Promise<Post>;
  toggleGate(id: number): Promise<Post>;

  // Post versions
  getVersionsForPost(postId: number): Promise<PostVersion[]>;
  restoreVersion(postId: number, versionId: number, savedBy?: number): Promise<Post>;

  // Post views
  recordView(postId: number): Promise<void>;
  getViewsByPost(postId: number): Promise<number>;

  // Link clicks
  recordClick(url: string, postId?: number, sourcePage?: string, eventId?: number): Promise<void>;
  getClickStats(): Promise<{ url: string; count: number }[]>;

  // Funnel tracking
  recordFunnelStep(step: string, sessionId?: string, metadata?: string): Promise<void>;

  // Scheduled emails (T-4 reminder + T+1 feedback per promotion booking)
  ensureScheduledEmailRows(bookingId: number, kind: string, scheduledFor: string, recipientEmail: string): Promise<void>;
  listPendingScheduledEmails(asOfDate: string): Promise<Array<{ id: number; bookingId: number; kind: string; scheduledFor: string; recipientEmail: string }>>;
  markScheduledEmailSent(id: number, status: "sent" | "failed" | "skipped", opts?: { error?: string; dryRun?: boolean }): Promise<void>;
  getScheduledEmailRow(id: number): Promise<{ id: number; bookingId: number; kind: string; scheduledFor: string; recipientEmail: string; status: string } | null>;
  listAllScheduledEmails(limit?: number): Promise<Array<{ id: number; bookingId: number; kind: string; scheduledFor: string; recipientEmail: string; status: string; sentAt: Date | null; errorMessage: string | null; dryRun: boolean; createdAt: Date | null }>>;
  // App settings (key/value, used for cron dry-run flag)
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  // Email blast tracking — opens + clicks
  createEmailBlast(kind: string, subject: string, recipientCount: number, pageSlug?: string | null): Promise<number>;
  recordEmailBlastEvent(blastId: number, recipientEmail: string, eventType: "open" | "click", url?: string | null): Promise<void>;
  listEmailBlastsWithStats(): Promise<Array<{
    id: number;
    kind: string;
    subject: string;
    pageSlug: string | null;
    recipientCount: number;
    sentAt: Date | null;
    opens: number;
    uniqueOpens: number;
    clicks: number;
    uniqueClicks: number;
  }>>;

  // World Cup watch party submissions
  createWorldCupSubmission(data: InsertWorldCupSubmission): Promise<WorldCupSubmission>;
  createWorldCupSubmissionRaw(row: any): Promise<void>;
  listWorldCupSubmissions(opts?: { status?: string }): Promise<WorldCupSubmission[]>;
  updateWorldCupSubmissionStatus(id: number, status: string, adminNotes?: string): Promise<WorldCupSubmission | undefined>;
  updateWorldCupSubmissionFields(id: number, fields: Partial<WorldCupSubmission>): Promise<WorldCupSubmission | undefined>;
  getApprovedWorldCupSubmissions(weekIndex?: number): Promise<WorldCupSubmission[]>;

  // NBA Finals watch party submissions (mirrors WC pattern)
  createNbaFinalsSubmission(data: InsertNbaFinalsSubmission): Promise<NbaFinalsSubmission>;
  createNbaFinalsSubmissionRaw(row: any): Promise<void>;
  listNbaFinalsSubmissions(opts?: { status?: string }): Promise<NbaFinalsSubmission[]>;
  updateNbaFinalsSubmissionStatus(id: number, status: string, adminNotes?: string): Promise<NbaFinalsSubmission | undefined>;
  updateNbaFinalsSubmissionFields(id: number, fields: Partial<NbaFinalsSubmission>): Promise<NbaFinalsSubmission | undefined>;
  getApprovedNbaFinalsSubmissions(gameNumber?: number): Promise<NbaFinalsSubmission[]>;

  // Generic landing-page submissions (any admin-created page that has submissionsEnabled)
  createLandingPageSubmission(data: InsertLandingPageSubmission): Promise<LandingPageSubmission>;
  createLandingPageSubmissionRaw(row: any): Promise<void>;
  listLandingPageSubmissions(pageId: number, opts?: { status?: string }): Promise<LandingPageSubmission[]>;
  updateLandingPageSubmissionStatus(id: number, status: string, adminNotes?: string): Promise<LandingPageSubmission | undefined>;
  updateLandingPageSubmissionFields(id: number, fields: Partial<LandingPageSubmission>): Promise<LandingPageSubmission | undefined>;
  getApprovedLandingPageSubmissions(pageId: number): Promise<LandingPageSubmission[]>;
  bulkUpdateLandingPageSubmissionStatus(ids: number[], status: string): Promise<number>;
  bulkDeleteLandingPageSubmissions(ids: number[]): Promise<number>;

  // Bulk operations (admin multi-select)
  bulkUpdateWorldCupSubmissionStatus(ids: number[], status: string): Promise<number>;
  bulkDeleteWorldCupSubmissions(ids: number[]): Promise<number>;
  bulkEditWorldCupSubmissions(ids: number[], fields: Partial<WorldCupSubmission>): Promise<number>;
  bulkUpdateNbaFinalsSubmissionStatus(ids: number[], status: string): Promise<number>;
  bulkDeleteNbaFinalsSubmissions(ids: number[]): Promise<number>;
  bulkEditNbaFinalsSubmissions(ids: number[], fields: Partial<NbaFinalsSubmission>): Promise<number>;

  // New analytics (event-level, regions, sources, funnel)
  getEventPerformance(days?: number, limit?: number): Promise<{ eventId: number; title: string; date: string; region: string; city: string | null; clicks: number }[]>;
  getTopRegions(days?: number): Promise<{ region: string; clicks: number; events: number }[]>;
  getTopCities(days?: number, limit?: number): Promise<{ city: string; region: string; clicks: number }[]>;
  getTrafficSources(days?: number): Promise<{ subscriberSources: { referrer: string; count: number }[]; clickSourcePages: { sourcePage: string; count: number }[] }>;
  getBookingFunnel(days?: number): Promise<{ step: string; sessions: number }[]>;

  // Comments
  getCommentsByPost(postId: number): Promise<Comment[]>;
  createComment(data: InsertComment): Promise<Comment>;

  // Per-page funnel — landing-page CMS submission flow
  getPagesFunnel(): Promise<Array<{
    pageId: number;
    slug: string;
    title: string;
    views: number;
    engagements: number;
    submissions: number;
    approved: number;
  }>>;

  // SEO health snapshot — scores every public URL on SEO basics
  getSeoHealth(): Promise<Array<{
    kind: "topic" | "page" | "post";
    slug: string;
    url: string;
    title: string;
    metaTitle: string;
    metaDescription: string;
    metaTitleLength: number;
    metaDescriptionLength: number;
    wordCount: number;
    h1Count: number;
    h2Count: number;
    faqCount: number;
    indexable: boolean;
    lastUpdated: Date | null;
    autoNoindex: boolean;
    matchingEventCount: number | null;
    issues: Array<{ severity: "error" | "warn"; code: string; message: string }>;
  }>>;

  // Analytics
  getAnalytics(days?: number): Promise<{
    totalSubscribers: number;
    postViews: { postId: number; title: string; views: number }[];
    linkClicks: { url: string; count: number; sourcePage: string | null }[];
    memberSources: { referrer: string; count: number }[];
    landingPaths: { landingPath: string; count: number }[];
    utmSources: { utmSource: string; count: number }[];
    window: {
      days: number | null;
      subscribers: number;
      postViews: number;
      linkClicks: number;
      prior: { subscribers: number; postViews: number; linkClicks: number };
    };
    daily: {
      subscribers: { date: string; count: number }[];
      postViews: { date: string; count: number }[];
      linkClicks: { date: string; count: number }[];
    };
  }>;
}

// Shared concrete type for the SEO health snapshot. Lifted out of the
// method body so the implementation can reference it without TS hitting
// a circular self-reference through the inferred return type.
type SeoHealthRow = {
  kind: "topic" | "page" | "post";
  slug: string;
  url: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  metaTitleLength: number;
  metaDescriptionLength: number;
  wordCount: number;
  h1Count: number;
  h2Count: number;
  faqCount: number;
  indexable: boolean;
  lastUpdated: Date | null;
  autoNoindex: boolean;
  matchingEventCount: number | null;
  issues: Array<{ severity: "error" | "warn"; code: string; message: string }>;
};

// ─── Implementation ───────────────────────────────────────────────────────

export class DatabaseStorage implements IStorage {
  // ── Subscribers ──────────────────────────────────────────────────────

  async createSubscriber(subscriber: InsertSubscriber): Promise<Subscriber> {
    const [newSubscriber] = await db.insert(newsletterSubscribers).values(subscriber).returning();
    return newSubscriber;
  }

  async findSubscriberByEmail(email: string): Promise<Subscriber | null> {
    const [sub] = await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email));
    return sub ?? null;
  }

  async importSubscribers(rows: Array<{ email: string; name?: string; region?: string; referrer?: string }>): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      const email = row.email.trim().toLowerCase();
      // Fallback name = email local-part if no explicit name provided in the import.
      const name = row.name?.trim() || email.split("@")[0] || email;
      try {
        const result = await db
          .insert(newsletterSubscribers)
          .values({
            email,
            name,
            region: row.region?.trim() || "All",
            referrer: row.referrer?.trim() || null,
          })
          .onConflictDoNothing()
          .returning();
        if (result.length > 0) {
          imported++;
          console.log(`[subscriber-import] ✓ inserted: ${email}`);
        } else {
          skipped++;
          console.log(`[subscriber-import] ⟳ skipped (duplicate): ${email}`);
        }
      } catch (err) {
        skipped++;
        console.error(`[subscriber-import] ✗ error for ${email}:`, err);
      }
    }
    return { imported, skipped };
  }

  async deleteSubscriber(id: number): Promise<void> {
    await db.delete(newsletterSubscribers).where(eq(newsletterSubscribers.id, id));
  }

  async bulkDeleteSubscribers(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;
    const deleted = await db.delete(newsletterSubscribers)
      .where(inArray(newsletterSubscribers.id, ids))
      .returning({ id: newsletterSubscribers.id });
    return deleted.length;
  }

  // Bulk-edit region and/or referrer (source) on selected subscribers.
  // Missing fields = no change; explicit null = clear the column.
  async bulkEditSubscribers(ids: number[], fields: { region?: string | null; referrer?: string | null }): Promise<number> {
    if (ids.length === 0) return 0;
    const patch: Partial<Subscriber> = {};
    if ("region" in fields) patch.region = fields.region ?? null;
    if ("referrer" in fields) patch.referrer = fields.referrer ?? null;
    if (Object.keys(patch).length === 0) return 0;
    const updated = await db.update(newsletterSubscribers)
      .set(patch)
      .where(inArray(newsletterSubscribers.id, ids))
      .returning({ id: newsletterSubscribers.id });
    return updated.length;
  }

  async upsertSubscriber(email: string, referrer?: string, name?: string): Promise<{ subscriber: Subscriber; isNew: boolean }> {
    const inserted = await db
      .insert(newsletterSubscribers)
      .values({
        email,
        name: name || email.split("@")[0],
        region: "All",
        referrer: referrer || null,
        hasAccess: true,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted.length > 0) {
      return { subscriber: inserted[0], isNew: true };
    }

    // Row already existed — fetch and return it
    const existing = await this.findSubscriberByEmail(email);
    return { subscriber: existing!, isNew: false };
  }

  // ── Bookings ──────────────────────────────────────────────────────────

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const [inserted] = await db.insert(promotionBookings).values(booking).returning();
    const year = new Date().getFullYear();
    const referenceId = `CGE-${year}-${String(inserted.id).padStart(4, "0")}`;
    const [newBooking] = await db
      .update(promotionBookings)
      .set({ referenceId })
      .where(eq(promotionBookings.id, inserted.id))
      .returning();
    return newBooking;
  }

  async getBookings(): Promise<Booking[]> {
    return await db.select().from(promotionBookings).orderBy(desc(promotionBookings.createdAt));
  }

  async updateBookingStatus(id: number, status: string): Promise<Booking | undefined> {
    const patch: Record<string, unknown> = { status };
    const stamp = stageTimestampField(status);
    if (stamp) patch[stamp] = new Date();
    const [updated] = await db
      .update(promotionBookings)
      .set(patch)
      .where(eq(promotionBookings.id, id))
      .returning();
    return updated;
  }

  async bulkUpdateBookingStatus(ids: number[], status: string): Promise<number> {
    if (ids.length === 0) return 0;
    const patch: Record<string, unknown> = { status };
    const stamp = stageTimestampField(status);
    if (stamp) patch[stamp] = new Date();
    const updated = await db
      .update(promotionBookings)
      .set(patch)
      .where(inArray(promotionBookings.id, ids))
      .returning({ id: promotionBookings.id });
    return updated.length;
  }

  async getStuckBookings(hoursOld: number): Promise<Booking[]> {
    // "Stuck" = non-terminal status (New or Contacted) whose most recent stage
    // timestamp is older than `hoursOld`. We compute last-change as the latest of
    // (createdAt, contactedAt, paidAt) — uses createdAt when stage timestamps are null
    // (legacy rows or status == New).
    const cutoff = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
    const rows = await db
      .select()
      .from(promotionBookings)
      .where(
        and(
          inArray(promotionBookings.status, ["New", "Contacted"]),
          sql`COALESCE(${promotionBookings.contactedAt}, ${promotionBookings.createdAt}) < ${cutoff}`,
        ),
      )
      .orderBy(promotionBookings.createdAt);
    return rows;
  }

  async updateBookingNotes(id: number, adminNotes: string): Promise<Booking | undefined> {
    const [updated] = await db
      .update(promotionBookings)
      .set({ adminNotes })
      .where(eq(promotionBookings.id, id))
      .returning();
    return updated;
  }

  async batchDeleteBookings(ids: number[]): Promise<void> {
    await db.delete(promotionBookings).where(inArray(promotionBookings.id, ids));
  }

  // ── Events ────────────────────────────────────────────────────────────

  async getEvents(region?: string, includePast = false): Promise<Event[]> {
    const currentDate = sql`CURRENT_DATE::text`;
    const dateFilter = includePast ? undefined : gte(events.date, currentDate);
    if (region && region !== "All") {
      const section = regionSection(region);
      if (section) {
        // Match any region whose value contains the section keyword
        // ("Central NJ", "central", "central jersey" all match "central").
        const regionFilter = sql`LOWER(${events.region}) LIKE ${"%" + section + "%"}`;
        const where = dateFilter ? and(regionFilter, dateFilter) : regionFilter;
        return await db.select().from(events).where(where);
      }
    }
    return dateFilter
      ? await db.select().from(events).where(dateFilter)
      : await db.select().from(events);
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const normalized = { ...event, region: normalizeRegion(event.region) || event.region };
    const [newEvent] = await db.insert(events).values(normalized).returning();
    return newEvent;
  }

  async updateEvent(id: number, data: Partial<InsertEvent>): Promise<Event> {
    const normalized = data.region ? { ...data, region: normalizeRegion(data.region) || data.region } : data;
    const [updated] = await db.update(events).set(normalized).where(eq(events.id, id)).returning();
    return updated;
  }

  async deleteEvent(id: number): Promise<void> {
    // link_clicks.event_id FKs the events table — null them out first to satisfy
    // the constraint. Click analytics rows survive (just no longer attributed
    // to the deleted event).
    await db.update(linkClicks).set({ eventId: null }).where(eq(linkClicks.eventId, id));
    await db.delete(events).where(eq(events.id, id));
  }

  async bulkDeleteEvents(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await db.update(linkClicks).set({ eventId: null }).where(inArray(linkClicks.eventId, ids));
    await db.delete(events).where(inArray(events.id, ids));
  }

  async bulkImportEvents(
    rows: InsertEvent[],
  ): Promise<{ imported: number; duplicates: { title: string; existingId: number; existingDate: string }[] }> {
    if (rows.length === 0) return { imported: 0, duplicates: [] };

    // Single SELECT for all titles in the batch, then dedupe (title, date) in memory.
    // Replaces an N+1 loop that timed out on 100+ row imports.
    const uniqueTitles = Array.from(new Set(rows.map((r) => r.title)));
    const existingMatches = await db
      .select({ id: events.id, title: events.title, date: events.date })
      .from(events)
      .where(inArray(events.title, uniqueTitles));

    const existingByKey = new Map<string, { id: number; date: string }>();
    for (const e of existingMatches) {
      existingByKey.set(`${e.title}|${e.date}`, { id: e.id, date: e.date });
    }

    const duplicates: { title: string; existingId: number; existingDate: string }[] = [];
    const toInsert: InsertEvent[] = [];
    const seenInBatch = new Set<string>();
    for (const row of rows) {
      const key = `${row.title}|${row.date}`;
      const dbHit = existingByKey.get(key);
      if (dbHit) {
        duplicates.push({ title: row.title, existingId: dbHit.id, existingDate: dbHit.date });
        continue;
      }
      if (seenInBatch.has(key)) continue;
      seenInBatch.add(key);
      toInsert.push({ ...row, region: normalizeRegion(row.region) || row.region });
    }

    if (toInsert.length > 0) {
      await db.insert(events).values(toInsert);
    }
    return { imported: toInsert.length, duplicates };
  }

  // ── Pages ─────────────────────────────────────────────────────────────

  async getPageBySlug(slug: string): Promise<Page | null> {
    const cached = pageCache.get(slug);
    if (cached && cached.expiresAt > Date.now()) return cached.page;
    const rows = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
    const page = rows[0] || null;
    pageCache.set(slug, { page, expiresAt: Date.now() + PAGE_CACHE_TTL_MS });
    return page;
  }

  async upsertPage(slug: string, data: Partial<InsertPage>): Promise<Page> {
    const existing = await this.getPageBySlug(slug);
    if (existing) {
      const [updated] = await db
        .update(pages)
        .set({ ...data, slug, updatedAt: new Date() })
        .where(eq(pages.slug, slug))
        .returning();
      pageCache.delete(slug);
      return updated;
    }
    const [created] = await db
      .insert(pages)
      .values({ slug, title: data.title ?? "", editorContent: data.editorContent ?? "", ...data })
      .returning();
    pageCache.delete(slug);
    return created;
  }

  // List all pages (admin-only). Used by the Pages admin tab.
  async listPages(): Promise<Page[]> {
    return await db.select().from(pages).orderBy(desc(pages.updatedAt));
  }

  // List published landing pages (excludes the legacy /things-to-do-in-nj page
  // which uses its own hardcoded route). Used for sitemap + public listing.
  async listPublishedLandingPages(): Promise<Page[]> {
    return await db
      .select()
      .from(pages)
      .where(and(eq(pages.published, true), sql`${pages.slug} != 'things-to-do-in-nj'`))
      .orderBy(desc(pages.updatedAt));
  }

  async deletePage(slug: string): Promise<boolean> {
    if (slug === "things-to-do-in-nj") return false; // protect legacy page
    const result = await db.delete(pages).where(eq(pages.slug, slug)).returning({ id: pages.id });
    pageCache.delete(slug);
    return result.length > 0;
  }

  async getPageById(id: number): Promise<Page | null> {
    const rows = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
    return rows[0] || null;
  }

  // Clone an existing page as a new draft. New slug = `<source>-copy`, or
  // `<source>-copy-2`, `<source>-copy-3` etc. if `-copy` already taken.
  async duplicatePage(sourceSlug: string): Promise<Page | null> {
    const source = await this.getPageBySlug(sourceSlug);
    if (!source) return null;
    let newSlug = `${sourceSlug}-copy`;
    let n = 2;
    while (await this.getPageBySlug(newSlug)) {
      newSlug = `${sourceSlug}-copy-${n++}`;
      if (n > 50) return null; // pathological safety
    }
    const { id: _ignoreId, updatedAt: _ignoreUpdated, viewCount: _ignoreViews, ...rest } = source as any;
    const [created] = await db.insert(pages).values({
      ...rest,
      slug: newSlug,
      title: `${source.title} (copy)`,
      published: false,
      viewCount: 0,
    }).returning();
    pageCache.delete(newSlug);
    return created;
  }

  async incrementPageViewCount(slug: string): Promise<void> {
    await db.update(pages)
      .set({ viewCount: sql`${pages.viewCount} + 1` })
      .where(eq(pages.slug, slug));
    // Don't invalidate cache — viewCount drift in the cache is acceptable,
    // and invalidating would mean every page-view triggers a DB re-read on
    // the next load. Cache expires naturally after 5 min and corrects itself.
  }

  async renamePageSlug(currentSlug: string, newSlug: string): Promise<Page | null> {
    if (currentSlug === newSlug) return this.getPageBySlug(currentSlug);
    if (newSlug === "things-to-do-in-nj") return null; // can't take the legacy slug
    // Conflict guard: don't allow renaming to an in-use slug
    const conflict = await this.getPageBySlug(newSlug);
    if (conflict) return null;
    const [updated] = await db.update(pages)
      .set({ slug: newSlug, updatedAt: new Date() })
      .where(eq(pages.slug, currentSlug))
      .returning();
    if (!updated) return null;
    // Insert redirect for the old slug → new slug. Skip if a row already
    // exists (e.g., already-renamed-once-and-back); update target instead.
    const existing = await db.select().from(pageRedirects).where(eq(pageRedirects.oldSlug, currentSlug)).limit(1);
    if (existing[0]) {
      await db.update(pageRedirects).set({ newSlug }).where(eq(pageRedirects.oldSlug, currentSlug));
    } else {
      await db.insert(pageRedirects).values({ oldSlug: currentSlug, newSlug });
    }
    pageCache.delete(currentSlug);
    pageCache.delete(newSlug);
    return updated;
  }

  async getPageRedirect(oldSlug: string): Promise<string | null> {
    const rows = await db.select().from(pageRedirects).where(eq(pageRedirects.oldSlug, oldSlug)).limit(1);
    return rows[0]?.newSlug || null;
  }

  // ── Admin users ───────────────────────────────────────────────────────

  async createAdminUser(data: Partial<InsertAdminUser>): Promise<AdminUser> {
    const [user] = await db.insert(adminUsers).values(data as InsertAdminUser).returning();
    return user;
  }

  async findAdminByEmail(email: string): Promise<AdminUser | null> {
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
    return user ?? null;
  }

  async findAdminById(id: number): Promise<AdminUser | null> {
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return user ?? null;
  }

  async findAdminByToken(token: string): Promise<AdminUser | null> {
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.inviteToken, token));
    return user ?? null;
  }

  async listAdminUsers(): Promise<Omit<AdminUser, "passwordHash">[]> {
    const users = await db.select().from(adminUsers).orderBy(desc(adminUsers.createdAt));
    return users.map(({ passwordHash: _, ...rest }) => rest);
  }

  async updateAdminUser(id: number, data: Partial<AdminUser>): Promise<AdminUser> {
    const [updated] = await db.update(adminUsers).set(data).where(eq(adminUsers.id, id)).returning();
    return updated;
  }

  async deactivateAdmin(id: number): Promise<void> {
    await db.update(adminUsers).set({ isActive: false }).where(eq(adminUsers.id, id));
  }

  async reactivateAdmin(id: number): Promise<void> {
    await db.update(adminUsers).set({ isActive: true }).where(eq(adminUsers.id, id));
  }

  async listSubscribers(): Promise<Subscriber[]> {
    return await db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.createdAt));
  }

  async countAdminUsers(): Promise<number> {
    const [row] = await db.select({ count: count() }).from(adminUsers);
    return Number(row?.count ?? 0);
  }

  // ── Posts ─────────────────────────────────────────────────────────────

  async createPost(data: Partial<InsertPost> & { title: string }): Promise<Post> {
    const slug = await makeUniqueSlug(data.title);
    const [post] = await db.insert(posts).values({ ...data, slug } as InsertPost).returning();
    return post;
  }

  async getPublishedPosts(): Promise<Partial<Post>[]> {
    return await db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        excerpt: posts.excerpt,
        coverImageUrl: posts.coverImageUrl,
        isGated: posts.isGated,
        publishedAt: posts.publishedAt,
      })
      .from(posts)
      .where(eq(posts.isPublished, true))
      .orderBy(desc(posts.publishedAt));
  }

  async getAllPosts(): Promise<Post[]> {
    return await db.select().from(posts).orderBy(desc(posts.createdAt));
  }

  async getPostBySlug(slug: string): Promise<Post | null> {
    const [post] = await db.select().from(posts).where(eq(posts.slug, slug));
    return post ?? null;
  }

  async getPostById(id: number): Promise<Post | null> {
    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    return post ?? null;
  }

  async updatePost(id: number, data: Partial<InsertPost>, savedBy?: number): Promise<Post> {
    const current = await this.getPostById(id);
    if (current) {
      await db.insert(postVersions).values({
        postId: id,
        title: current.title,
        content: current.content ?? "",
        savedBy: savedBy ?? null,
      });
    }
    const updateData: Partial<Post> = { ...data, updatedAt: new Date() };
    if (data.title) {
      updateData.slug = await makeUniqueSlug(data.title, id);
    }
    const [updated] = await db.update(posts).set(updateData).where(eq(posts.id, id)).returning();
    return updated;
  }

  async deletePost(id: number): Promise<void> {
    await db.delete(postVersions).where(eq(postVersions.postId, id));
    await db.delete(postViews).where(eq(postViews.postId, id));
    await db.delete(linkClicks).where(eq(linkClicks.postId, id));
    await db.delete(comments).where(eq(comments.postId, id));
    await db.delete(posts).where(eq(posts.id, id));
  }

  async togglePublish(id: number): Promise<Post> {
    const post = await this.getPostById(id);
    if (!post) throw new Error("Post not found");
    const nowPublished = !post.isPublished;
    const [updated] = await db
      .update(posts)
      .set({
        isPublished: nowPublished,
        publishedAt: nowPublished && !post.publishedAt ? new Date() : post.publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id))
      .returning();
    return updated;
  }

  async toggleGate(id: number): Promise<Post> {
    const post = await this.getPostById(id);
    if (!post) throw new Error("Post not found");
    const [updated] = await db
      .update(posts)
      .set({ isGated: !post.isGated, updatedAt: new Date() })
      .where(eq(posts.id, id))
      .returning();
    return updated;
  }

  // ── Post versions ─────────────────────────────────────────────────────

  async getVersionsForPost(postId: number): Promise<PostVersion[]> {
    return await db
      .select()
      .from(postVersions)
      .where(eq(postVersions.postId, postId))
      .orderBy(desc(postVersions.savedAt));
  }

  async restoreVersion(postId: number, versionId: number, savedBy?: number): Promise<Post> {
    const [version] = await db
      .select()
      .from(postVersions)
      .where(and(eq(postVersions.id, versionId), eq(postVersions.postId, postId)));
    if (!version) throw new Error("Version not found or does not belong to this post");
    return this.updatePost(postId, { title: version.title, content: version.content }, savedBy);
  }

  // ── Post views ────────────────────────────────────────────────────────

  async recordView(postId: number): Promise<void> {
    await db.insert(postViews).values({ postId });
  }

  async getViewsByPost(postId: number): Promise<number> {
    const [row] = await db.select({ total: count() }).from(postViews).where(eq(postViews.postId, postId));
    return Number(row?.total ?? 0);
  }

  // ── Link clicks ───────────────────────────────────────────────────────

  async recordClick(url: string, postId?: number, sourcePage?: string, eventId?: number): Promise<void> {
    await db.insert(linkClicks).values({
      url,
      postId: postId ?? null,
      eventId: eventId ?? null,
      sourcePage: sourcePage ?? null,
    });
  }

  async getClickStats(): Promise<{ url: string; count: number }[]> {
    const rows = await db
      .select({ url: linkClicks.url, total: count() })
      .from(linkClicks)
      .groupBy(linkClicks.url)
      .orderBy(desc(count()));
    return rows.map((r) => ({ url: r.url, count: Number(r.total) }));
  }

  async recordFunnelStep(step: string, sessionId?: string, metadata?: string): Promise<void> {
    await db.insert(funnelEvents).values({
      step,
      sessionId: sessionId ?? null,
      metadata: metadata ?? null,
    });
  }

  // ── Scheduled email sends ─────────────────────────────────────────────
  // Idempotent: dedupes on (bookingId, kind). Repeated cron ticks won't
  // insert dup rows even if a backfill loop happens to run twice.
  async ensureScheduledEmailRows(bookingId: number, kind: string, scheduledFor: string, recipientEmail: string): Promise<void> {
    const existing = await db
      .select({ id: scheduledEmailSends.id })
      .from(scheduledEmailSends)
      .where(and(eq(scheduledEmailSends.bookingId, bookingId), eq(scheduledEmailSends.kind, kind)))
      .limit(1);
    if (existing.length > 0) return;
    await db.insert(scheduledEmailSends).values({ bookingId, kind, scheduledFor, recipientEmail });
  }

  async listPendingScheduledEmails(asOfDate: string) {
    const rows = await db
      .select({
        id: scheduledEmailSends.id,
        bookingId: scheduledEmailSends.bookingId,
        kind: scheduledEmailSends.kind,
        scheduledFor: scheduledEmailSends.scheduledFor,
        recipientEmail: scheduledEmailSends.recipientEmail,
      })
      .from(scheduledEmailSends)
      .where(and(eq(scheduledEmailSends.status, "pending"), sql`${scheduledEmailSends.scheduledFor} <= ${asOfDate}`))
      .orderBy(scheduledEmailSends.scheduledFor);
    return rows;
  }

  async markScheduledEmailSent(id: number, status: "sent" | "failed" | "skipped", opts?: { error?: string; dryRun?: boolean }): Promise<void> {
    await db
      .update(scheduledEmailSends)
      .set({
        status,
        sentAt: status === "sent" ? new Date() : null,
        errorMessage: opts?.error ?? null,
        dryRun: opts?.dryRun ?? false,
      })
      .where(eq(scheduledEmailSends.id, id));
  }

  async getScheduledEmailRow(id: number) {
    const [row] = await db
      .select({
        id: scheduledEmailSends.id,
        bookingId: scheduledEmailSends.bookingId,
        kind: scheduledEmailSends.kind,
        scheduledFor: scheduledEmailSends.scheduledFor,
        recipientEmail: scheduledEmailSends.recipientEmail,
        status: scheduledEmailSends.status,
      })
      .from(scheduledEmailSends)
      .where(eq(scheduledEmailSends.id, id))
      .limit(1);
    return row ?? null;
  }

  async listAllScheduledEmails(limit: number = 500) {
    return await db
      .select({
        id: scheduledEmailSends.id,
        bookingId: scheduledEmailSends.bookingId,
        kind: scheduledEmailSends.kind,
        scheduledFor: scheduledEmailSends.scheduledFor,
        recipientEmail: scheduledEmailSends.recipientEmail,
        status: scheduledEmailSends.status,
        sentAt: scheduledEmailSends.sentAt,
        errorMessage: scheduledEmailSends.errorMessage,
        dryRun: scheduledEmailSends.dryRun,
        createdAt: scheduledEmailSends.createdAt,
      })
      .from(scheduledEmailSends)
      .orderBy(desc(scheduledEmailSends.scheduledFor), desc(scheduledEmailSends.id))
      .limit(limit);
  }

  // ── App settings (key/value) ──────────────────────────────────────────
  async getSetting(key: string): Promise<string | null> {
    const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, key)).limit(1);
    return row?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const existing = await this.getSetting(key);
    if (existing === null) {
      await db.insert(appSettings).values({ key, value });
    } else {
      await db.update(appSettings).set({ value, updatedAt: new Date() }).where(eq(appSettings.key, key));
    }
  }

  // ── Email blast tracking ──────────────────────────────────────────────
  async createEmailBlast(kind: string, subject: string, recipientCount: number, pageSlug?: string | null): Promise<number> {
    const [row] = await db
      .insert(emailBlasts)
      .values({ kind, subject: subject.slice(0, 500), recipientCount, pageSlug: pageSlug ?? null })
      .returning({ id: emailBlasts.id });
    return row.id;
  }

  async recordEmailBlastEvent(blastId: number, recipientEmail: string, eventType: "open" | "click", url?: string | null): Promise<void> {
    await db.insert(emailBlastEvents).values({
      blastId,
      recipientEmail: recipientEmail.slice(0, 320),
      eventType,
      url: url ? url.slice(0, 2000) : null,
    });
  }

  async listEmailBlastsWithStats() {
    const blasts = await db
      .select({
        id: emailBlasts.id,
        kind: emailBlasts.kind,
        subject: emailBlasts.subject,
        pageSlug: emailBlasts.pageSlug,
        recipientCount: emailBlasts.recipientCount,
        sentAt: emailBlasts.sentAt,
      })
      .from(emailBlasts)
      .orderBy(desc(emailBlasts.sentAt));

    const stats = await db
      .select({
        blastId: emailBlastEvents.blastId,
        eventType: emailBlastEvents.eventType,
        total: count(),
        unique: sql<number>`COUNT(DISTINCT ${emailBlastEvents.recipientEmail})`,
      })
      .from(emailBlastEvents)
      .groupBy(emailBlastEvents.blastId, emailBlastEvents.eventType);

    return blasts.map((b) => {
      const openRow = stats.find((s) => s.blastId === b.id && s.eventType === "open");
      const clickRow = stats.find((s) => s.blastId === b.id && s.eventType === "click");
      return {
        ...b,
        opens: openRow ? Number(openRow.total) : 0,
        uniqueOpens: openRow ? Number(openRow.unique) : 0,
        clicks: clickRow ? Number(clickRow.total) : 0,
        uniqueClicks: clickRow ? Number(clickRow.unique) : 0,
      };
    });
  }

  // ── World Cup watch party submissions ─────────────────────────────────
  async createWorldCupSubmission(data: InsertWorldCupSubmission): Promise<WorldCupSubmission> {
    const [created] = await db.insert(worldCupSubmissions).values(data).returning();
    return created;
  }

  // Used by admin bulk-import — bypasses the public-form insert schema so we
  // can set status/source/reviewedAt directly. Row is pre-validated by the route.
  async createWorldCupSubmissionRaw(row: any): Promise<void> {
    await db.insert(worldCupSubmissions).values(row);
  }

  async listWorldCupSubmissions(opts?: { status?: string }): Promise<WorldCupSubmission[]> {
    if (opts?.status) {
      return await db.select().from(worldCupSubmissions)
        .where(eq(worldCupSubmissions.status, opts.status))
        .orderBy(desc(worldCupSubmissions.createdAt));
    }
    return await db.select().from(worldCupSubmissions).orderBy(desc(worldCupSubmissions.createdAt));
  }

  async updateWorldCupSubmissionStatus(id: number, status: string, adminNotes?: string): Promise<WorldCupSubmission | undefined> {
    const patch: Partial<WorldCupSubmission> = { status, reviewedAt: new Date() };
    if (adminNotes !== undefined) patch.adminNotes = adminNotes;
    const [updated] = await db.update(worldCupSubmissions)
      .set(patch)
      .where(eq(worldCupSubmissions.id, id))
      .returning();
    return updated;
  }

  // Used by the admin "Edit submission" modal — accepts any subset of mutable fields.
  async updateWorldCupSubmissionFields(id: number, fields: Partial<WorldCupSubmission>): Promise<WorldCupSubmission | undefined> {
    if (Object.keys(fields).length === 0) {
      const [row] = await db.select().from(worldCupSubmissions).where(eq(worldCupSubmissions.id, id));
      return row;
    }
    const [updated] = await db.update(worldCupSubmissions)
      .set(fields)
      .where(eq(worldCupSubmissions.id, id))
      .returning();
    return updated;
  }

  async getApprovedWorldCupSubmissions(weekIndex?: number): Promise<WorldCupSubmission[]> {
    const conds = weekIndex
      ? and(eq(worldCupSubmissions.status, "approved"), eq(worldCupSubmissions.weekIndex, weekIndex))
      : eq(worldCupSubmissions.status, "approved");
    return await db.select().from(worldCupSubmissions)
      .where(conds)
      .orderBy(worldCupSubmissions.matchDate);
  }

  // ── NBA Finals watch party submissions (mirrors WC pattern) ───────────
  async createNbaFinalsSubmission(data: InsertNbaFinalsSubmission): Promise<NbaFinalsSubmission> {
    const [created] = await db.insert(nbaFinalsSubmissions).values(data).returning();
    return created;
  }

  async createNbaFinalsSubmissionRaw(row: any): Promise<void> {
    await db.insert(nbaFinalsSubmissions).values(row);
  }

  async listNbaFinalsSubmissions(opts?: { status?: string }): Promise<NbaFinalsSubmission[]> {
    if (opts?.status) {
      return await db.select().from(nbaFinalsSubmissions)
        .where(eq(nbaFinalsSubmissions.status, opts.status))
        .orderBy(desc(nbaFinalsSubmissions.createdAt));
    }
    return await db.select().from(nbaFinalsSubmissions).orderBy(desc(nbaFinalsSubmissions.createdAt));
  }

  async updateNbaFinalsSubmissionStatus(id: number, status: string, adminNotes?: string): Promise<NbaFinalsSubmission | undefined> {
    const patch: Partial<NbaFinalsSubmission> = { status, reviewedAt: new Date() };
    if (adminNotes !== undefined) patch.adminNotes = adminNotes;
    const [updated] = await db.update(nbaFinalsSubmissions)
      .set(patch)
      .where(eq(nbaFinalsSubmissions.id, id))
      .returning();
    return updated;
  }

  async updateNbaFinalsSubmissionFields(id: number, fields: Partial<NbaFinalsSubmission>): Promise<NbaFinalsSubmission | undefined> {
    if (Object.keys(fields).length === 0) {
      const [row] = await db.select().from(nbaFinalsSubmissions).where(eq(nbaFinalsSubmissions.id, id));
      return row;
    }
    const [updated] = await db.update(nbaFinalsSubmissions)
      .set(fields)
      .where(eq(nbaFinalsSubmissions.id, id))
      .returning();
    return updated;
  }

  async getApprovedNbaFinalsSubmissions(gameNumber?: number): Promise<NbaFinalsSubmission[]> {
    const conds = gameNumber
      ? and(eq(nbaFinalsSubmissions.status, "approved"), eq(nbaFinalsSubmissions.gameNumber, gameNumber))
      : eq(nbaFinalsSubmissions.status, "approved");
    return await db.select().from(nbaFinalsSubmissions)
      .where(conds)
      .orderBy(nbaFinalsSubmissions.gameDate);
  }

  // ── Landing-page submissions (generic, per-page) ───────────────────────
  async createLandingPageSubmission(data: InsertLandingPageSubmission): Promise<LandingPageSubmission> {
    const [created] = await db.insert(landingPageSubmissions).values(data).returning();
    return created;
  }

  async createLandingPageSubmissionRaw(row: any): Promise<void> {
    await db.insert(landingPageSubmissions).values(row);
  }

  async listLandingPageSubmissions(pageId: number, opts?: { status?: string }): Promise<LandingPageSubmission[]> {
    const conds = opts?.status
      ? and(eq(landingPageSubmissions.pageId, pageId), eq(landingPageSubmissions.status, opts.status))
      : eq(landingPageSubmissions.pageId, pageId);
    return await db.select().from(landingPageSubmissions)
      .where(conds)
      .orderBy(desc(landingPageSubmissions.createdAt));
  }

  async updateLandingPageSubmissionStatus(id: number, status: string, adminNotes?: string): Promise<LandingPageSubmission | undefined> {
    const patch: Partial<LandingPageSubmission> = { status, reviewedAt: new Date() };
    if (adminNotes !== undefined) patch.adminNotes = adminNotes;
    const [updated] = await db.update(landingPageSubmissions)
      .set(patch)
      .where(eq(landingPageSubmissions.id, id))
      .returning();
    return updated;
  }

  async updateLandingPageSubmissionFields(id: number, fields: Partial<LandingPageSubmission>): Promise<LandingPageSubmission | undefined> {
    if (Object.keys(fields).length === 0) {
      const [row] = await db.select().from(landingPageSubmissions).where(eq(landingPageSubmissions.id, id));
      return row;
    }
    const [updated] = await db.update(landingPageSubmissions)
      .set(fields)
      .where(eq(landingPageSubmissions.id, id))
      .returning();
    return updated;
  }

  async getApprovedLandingPageSubmissions(pageId: number): Promise<LandingPageSubmission[]> {
    return await db.select().from(landingPageSubmissions)
      .where(and(eq(landingPageSubmissions.pageId, pageId), eq(landingPageSubmissions.status, "approved")))
      .orderBy(landingPageSubmissions.eventDate);
  }

  async bulkUpdateLandingPageSubmissionStatus(ids: number[], status: string): Promise<number> {
    if (ids.length === 0) return 0;
    const updated = await db.update(landingPageSubmissions)
      .set({ status, reviewedAt: new Date() })
      .where(inArray(landingPageSubmissions.id, ids))
      .returning({ id: landingPageSubmissions.id });
    return updated.length;
  }

  async bulkDeleteLandingPageSubmissions(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;
    const deleted = await db.delete(landingPageSubmissions)
      .where(inArray(landingPageSubmissions.id, ids))
      .returning({ id: landingPageSubmissions.id });
    return deleted.length;
  }

  // ── Bulk admin operations ─────────────────────────────────────────────
  async bulkUpdateWorldCupSubmissionStatus(ids: number[], status: string): Promise<number> {
    if (ids.length === 0) return 0;
    const updated = await db.update(worldCupSubmissions)
      .set({ status, reviewedAt: new Date() })
      .where(inArray(worldCupSubmissions.id, ids))
      .returning({ id: worldCupSubmissions.id });
    return updated.length;
  }

  async bulkDeleteWorldCupSubmissions(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;
    const deleted = await db.delete(worldCupSubmissions)
      .where(inArray(worldCupSubmissions.id, ids))
      .returning({ id: worldCupSubmissions.id });
    return deleted.length;
  }

  async bulkUpdateNbaFinalsSubmissionStatus(ids: number[], status: string): Promise<number> {
    if (ids.length === 0) return 0;
    const updated = await db.update(nbaFinalsSubmissions)
      .set({ status, reviewedAt: new Date() })
      .where(inArray(nbaFinalsSubmissions.id, ids))
      .returning({ id: nbaFinalsSubmissions.id });
    return updated.length;
  }

  async bulkDeleteNbaFinalsSubmissions(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;
    const deleted = await db.delete(nbaFinalsSubmissions)
      .where(inArray(nbaFinalsSubmissions.id, ids))
      .returning({ id: nbaFinalsSubmissions.id });
    return deleted.length;
  }

  async bulkEditWorldCupSubmissions(ids: number[], fields: Partial<WorldCupSubmission>): Promise<number> {
    if (ids.length === 0 || Object.keys(fields).length === 0) return 0;
    const updated = await db.update(worldCupSubmissions)
      .set(fields)
      .where(inArray(worldCupSubmissions.id, ids))
      .returning({ id: worldCupSubmissions.id });
    return updated.length;
  }

  async bulkEditNbaFinalsSubmissions(ids: number[], fields: Partial<NbaFinalsSubmission>): Promise<number> {
    if (ids.length === 0 || Object.keys(fields).length === 0) return 0;
    const updated = await db.update(nbaFinalsSubmissions)
      .set(fields)
      .where(inArray(nbaFinalsSubmissions.id, ids))
      .returning({ id: nbaFinalsSubmissions.id });
    return updated.length;
  }

  async getEventPerformance(days?: number, limit = 20) {
    const since = days ? new Date(Date.now() - days * 86_400_000) : null;
    const rows = await db
      .select({
        eventId: linkClicks.eventId,
        title: events.title,
        date: events.date,
        region: events.region,
        city: events.city,
        clicks: count(),
      })
      .from(linkClicks)
      .innerJoin(events, eq(linkClicks.eventId, events.id))
      .where(since ? gte(linkClicks.clickedAt, since) : sql`TRUE`)
      .groupBy(linkClicks.eventId, events.title, events.date, events.region, events.city)
      .orderBy(desc(count()))
      .limit(limit);
    return rows.map((r) => ({
      eventId: r.eventId ?? 0,
      title: r.title,
      date: r.date,
      region: r.region,
      city: r.city,
      clicks: Number(r.clicks),
    }));
  }

  async getTopRegions(days?: number) {
    const since = days ? new Date(Date.now() - days * 86_400_000) : null;
    const rows = await db
      .select({
        region: events.region,
        clicks: count(linkClicks.id),
        events: sql<number>`COUNT(DISTINCT ${events.id})`,
      })
      .from(linkClicks)
      .innerJoin(events, eq(linkClicks.eventId, events.id))
      .where(since ? gte(linkClicks.clickedAt, since) : sql`TRUE`)
      .groupBy(events.region)
      .orderBy(desc(count(linkClicks.id)));
    return rows.map((r) => ({ region: r.region, clicks: Number(r.clicks), events: Number(r.events) }));
  }

  async getTopCities(days?: number, limit = 10) {
    const since = days ? new Date(Date.now() - days * 86_400_000) : null;
    const rows = await db
      .select({
        city: events.city,
        region: events.region,
        clicks: count(),
      })
      .from(linkClicks)
      .innerJoin(events, eq(linkClicks.eventId, events.id))
      .where(
        and(
          isNull(events.city) ? sql`FALSE` : sql`${events.city} IS NOT NULL`,
          since ? gte(linkClicks.clickedAt, since) : sql`TRUE`,
        ),
      )
      .groupBy(events.city, events.region)
      .orderBy(desc(count()))
      .limit(limit);
    return rows
      .filter((r) => r.city)
      .map((r) => ({ city: r.city as string, region: r.region, clicks: Number(r.clicks) }));
  }

  async getTrafficSources(days?: number) {
    const since = days ? new Date(Date.now() - days * 86_400_000) : null;
    const subRows = await db
      .select({ referrer: newsletterSubscribers.referrer, count: count() })
      .from(newsletterSubscribers)
      .where(since ? gte(newsletterSubscribers.createdAt, since) : sql`TRUE`)
      .groupBy(newsletterSubscribers.referrer)
      .orderBy(desc(count()));

    const clickRows = await db
      .select({ sourcePage: linkClicks.sourcePage, count: count() })
      .from(linkClicks)
      .where(
        and(
          sql`${linkClicks.sourcePage} IS NOT NULL`,
          since ? gte(linkClicks.clickedAt, since) : sql`TRUE`,
        ),
      )
      .groupBy(linkClicks.sourcePage)
      .orderBy(desc(count()))
      .limit(10);

    return {
      subscriberSources: subRows.map((r) => ({ referrer: r.referrer ?? "direct", count: Number(r.count) })),
      clickSourcePages: clickRows.map((r) => ({ sourcePage: r.sourcePage ?? "", count: Number(r.count) })),
    };
  }

  async getBookingFunnel(days?: number) {
    const since = days ? new Date(Date.now() - days * 86_400_000) : null;
    const rows = await db
      .select({
        step: funnelEvents.step,
        sessions: sql<number>`COUNT(DISTINCT ${funnelEvents.sessionId})`,
      })
      .from(funnelEvents)
      .where(since ? gte(funnelEvents.createdAt, since) : sql`TRUE`)
      .groupBy(funnelEvents.step);
    return rows.map((r) => ({ step: r.step, sessions: Number(r.sessions) }));
  }

  // ── Comments ──────────────────────────────────────────────────────────

  async getCommentsByPost(postId: number): Promise<Comment[]> {
    return await db
      .select()
      .from(comments)
      .where(eq(comments.postId, postId))
      .orderBy(comments.createdAt);
  }

  async createComment(data: InsertComment): Promise<Comment> {
    const [comment] = await db.insert(comments).values(data).returning();
    return comment;
  }

  // ── Per-page funnel ───────────────────────────────────────────────────
  // Returns one row per landing page with the four funnel stages:
  //   views (lifetime, from pages.viewCount)
  //   engagements (funnel events with step "landing-form-engaged:<slug>")
  //   submissions (any status, count of landing_page_submissions for the page)
  //   approved (subset of submissions with status='approved')
  // Excludes the legacy /things-to-do-in-nj page since it uses a different
  // render path and its viewCount doesn't reflect the same funnel.
  async getPagesFunnel() {
    const pageRows = await db
      .select({ id: pages.id, slug: pages.slug, title: pages.title, views: pages.viewCount })
      .from(pages)
      .where(sql`${pages.slug} != 'things-to-do-in-nj'`)
      .orderBy(desc(pages.viewCount));

    const subRows = await db
      .select({
        pageId: landingPageSubmissions.pageId,
        status: landingPageSubmissions.status,
        count: count(),
      })
      .from(landingPageSubmissions)
      .groupBy(landingPageSubmissions.pageId, landingPageSubmissions.status);

    const engagementRows = await db
      .select({
        step: funnelEvents.step,
        count: sql<number>`COUNT(DISTINCT ${funnelEvents.sessionId})`,
      })
      .from(funnelEvents)
      .where(sql`${funnelEvents.step} LIKE 'landing-form-engaged:%'`)
      .groupBy(funnelEvents.step);

    const engagementBySlug = new Map<string, number>();
    for (const r of engagementRows) {
      const slug = r.step.replace(/^landing-form-engaged:/, "");
      engagementBySlug.set(slug, Number(r.count));
    }

    return pageRows.map((p) => {
      const submissions = subRows.filter((s) => s.pageId === p.id).reduce((sum, s) => sum + Number(s.count), 0);
      const approved = subRows.filter((s) => s.pageId === p.id && s.status === "approved").reduce((sum, s) => sum + Number(s.count), 0);
      return {
        pageId: p.id,
        slug: p.slug,
        title: p.title || p.slug,
        views: Number(p.views ?? 0),
        engagements: engagementBySlug.get(p.slug) ?? 0,
        submissions,
        approved,
      };
    });
  }

  // ── SEO health ────────────────────────────────────────────────────────
  // Snapshot of every public URL we control with the SEO basics scored.
  // Stitches together programmatic topics, CMS landing pages, and blog
  // posts into one ranking-issue feed for the admin.
  async getSeoHealth(): Promise<SeoHealthRow[]> {
    const { getAllTopics, countMatchingEvents } = await import("@shared/seo-topics");
    const allEvents = await db.select().from(events);
    const topics = getAllTopics();
    const pageRows = await db.select().from(pages);
    const postRows = await db.select().from(posts).where(eq(posts.isPublished, true));

    const rows: SeoHealthRow[] = [];

    // Helpers — kept inline so the SEO scoring logic stays in one spot.
    const stripHtml = (html: string) => html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ");
    const wordCountOf = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
    const countTag = (html: string, tag: string) => (html.match(new RegExp(`<${tag}\\b`, "gi")) || []).length;

    const scoreIssues = (r: Omit<SeoHealthRow, "issues">): SeoHealthRow["issues"] => {
      const issues: SeoHealthRow["issues"] = [];
      if (!r.metaTitle) issues.push({ severity: "error", code: "missing-title", message: "Meta title missing" });
      else if (r.metaTitleLength < 30) issues.push({ severity: "warn", code: "short-title", message: `Meta title is ${r.metaTitleLength} chars — aim for 50-60` });
      else if (r.metaTitleLength > 65) issues.push({ severity: "warn", code: "long-title", message: `Meta title is ${r.metaTitleLength} chars — Google truncates around 60` });
      if (!r.metaDescription) issues.push({ severity: "error", code: "missing-description", message: "Meta description missing" });
      else if (r.metaDescriptionLength < 70) issues.push({ severity: "warn", code: "short-description", message: `Meta description is ${r.metaDescriptionLength} chars — aim for 140-160` });
      else if (r.metaDescriptionLength > 170) issues.push({ severity: "warn", code: "long-description", message: `Meta description is ${r.metaDescriptionLength} chars — Google truncates around 160` });
      if (r.wordCount < 200) issues.push({ severity: "error", code: "thin-content", message: `Only ${r.wordCount} words — too thin to rank for competitive queries` });
      else if (r.wordCount < 500) issues.push({ severity: "warn", code: "shallow-content", message: `${r.wordCount} words — bump to 800+ for stronger ranking signals` });
      if (r.h1Count === 0) issues.push({ severity: "error", code: "no-h1", message: "No H1 on page" });
      else if (r.h1Count > 1) issues.push({ severity: "warn", code: "multi-h1", message: `${r.h1Count} H1s — should be exactly 1` });
      if (r.faqCount === 0) issues.push({ severity: "warn", code: "no-faq", message: "No FAQ items — adding 3-5 enables FAQ rich snippets in Google" });
      if (!r.indexable) issues.push({ severity: "error", code: "noindex", message: "Page is set to noindex — Google won't rank it" });
      if (r.autoNoindex) issues.push({ severity: "warn", code: "auto-noindex", message: `Auto-noindexed: only ${r.matchingEventCount} matching events this week (need 3+)` });
      return issues;
    };

    // 1) Programmatic topics from shared/seo-topics
    for (const t of topics) {
      const introHtml = t.introParagraphs.join(" ");
      const introText = stripHtml(introHtml);
      const faqText = (t.faqItems || []).map((f) => `${f.q} ${f.a}`).join(" ");
      const wordCount = wordCountOf(introText + " " + faqText);
      const matching = countMatchingEvents(allEvents as any, t.filter);
      const autoNoindex = !t.alwaysIndex && matching < 3;
      const indexable = !autoNoindex;
      const base = {
        kind: "topic" as const,
        slug: t.slug,
        url: `/${t.slug}`,
        title: t.h1,
        metaTitle: t.metaTitle,
        metaDescription: t.metaDescription,
        metaTitleLength: t.metaTitle.length,
        metaDescriptionLength: t.metaDescription.length,
        wordCount,
        h1Count: 1, // TopicLanding always renders exactly one H1
        h2Count: t.faqItems?.length ? 1 : 0, // FAQ heading is the only H2
        faqCount: t.faqItems?.length ?? 0,
        indexable,
        lastUpdated: null,
        autoNoindex,
        matchingEventCount: matching,
      };
      rows.push({ ...base, issues: scoreIssues(base) });
    }

    // 2) CMS landing pages
    for (const p of pageRows) {
      const editorText = stripHtml(p.editorContent || "");
      let faqCount = 0;
      try { faqCount = (JSON.parse(p.faqItems || "[]") as any[]).length; } catch {}
      const wordCount = wordCountOf(editorText) + (p.title?.split(/\s+/).length || 0);
      const base = {
        kind: "page" as const,
        slug: p.slug,
        url: `/${p.slug}`,
        title: p.title || p.slug,
        metaTitle: p.metaTitle || "",
        metaDescription: p.metaDescription || "",
        metaTitleLength: (p.metaTitle || "").length,
        metaDescriptionLength: (p.metaDescription || "").length,
        wordCount,
        h1Count: 1, // PageRenderer always renders exactly one H1 from `title`
        h2Count: countTag(p.editorContent || "", "h2"),
        faqCount,
        indexable: !!p.indexable && !!p.published,
        lastUpdated: p.updatedAt ?? null,
        autoNoindex: false,
        matchingEventCount: null,
      };
      rows.push({ ...base, issues: scoreIssues(base) });
    }

    // 3) Published blog posts
    for (const p of postRows) {
      const bodyText = stripHtml(p.content || "");
      const wordCount = wordCountOf(bodyText);
      const base = {
        kind: "post" as const,
        slug: p.slug,
        url: `/blog/${p.slug}`,
        title: p.title,
        metaTitle: p.title, // Posts use title as meta title in SSR
        metaDescription: p.excerpt || "",
        metaTitleLength: p.title.length,
        metaDescriptionLength: (p.excerpt || "").length,
        wordCount,
        h1Count: 1,
        h2Count: countTag(p.content || "", "h2"),
        faqCount: 0,
        indexable: true,
        lastUpdated: p.updatedAt ?? p.createdAt ?? null,
        autoNoindex: false,
        matchingEventCount: null,
      };
      rows.push({ ...base, issues: scoreIssues(base) });
    }

    return rows;
  }

  // ── Analytics ─────────────────────────────────────────────────────────

  async getAnalytics(days?: number) {
    const [{ total }] = await db
      .select({ total: count() })
      .from(newsletterSubscribers);

    const viewRows = await db
      .select({
        postId: postViews.postId,
        title: posts.title,
        views: count(),
      })
      .from(postViews)
      .leftJoin(posts, eq(postViews.postId, posts.id))
      .groupBy(postViews.postId, posts.title)
      .orderBy(desc(count()));

    const clickRows = await db
      .select({
        url: linkClicks.url,
        count: count(),
        sourcePage: sql<string | null>`max(${linkClicks.sourcePage})`,
      })
      .from(linkClicks)
      .groupBy(linkClicks.url)
      .orderBy(desc(count()));

    const sourceRows = await db
      .select({
        referrer: newsletterSubscribers.referrer,
        count: count(),
      })
      .from(newsletterSubscribers)
      .groupBy(newsletterSubscribers.referrer)
      .orderBy(desc(count()));

    const landingPathRows = await db
      .select({
        landingPath: newsletterSubscribers.landingPath,
        count: count(),
      })
      .from(newsletterSubscribers)
      .where(sql`${newsletterSubscribers.landingPath} IS NOT NULL`)
      .groupBy(newsletterSubscribers.landingPath)
      .orderBy(desc(count()));

    const utmSourceRows = await db
      .select({
        utmSource: newsletterSubscribers.utmSource,
        count: count(),
      })
      .from(newsletterSubscribers)
      .where(sql`${newsletterSubscribers.utmSource} IS NOT NULL`)
      .groupBy(newsletterSubscribers.utmSource)
      .orderBy(desc(count()));

    // Window-scoped totals + prior-period comparison for % change.
    const now = new Date();
    const windowStart = days ? new Date(now.getTime() - days * 86_400_000) : null;
    const priorStart = days ? new Date(now.getTime() - 2 * days * 86_400_000) : null;

    const countSince = async <T extends { createdAt?: any; viewedAt?: any; clickedAt?: any }>(
      table: any,
      col: any,
      from: Date | null,
      to: Date | null,
    ) => {
      if (!from) {
        const [r] = await db.select({ c: count() }).from(table);
        return Number(r.c);
      }
      const conds = to ? and(gte(col, from), lt(col, to)) : gte(col, from);
      const [r] = await db.select({ c: count() }).from(table).where(conds);
      return Number(r.c);
    };

    const [
      windowSubs,
      windowViews,
      windowClicks,
      priorSubs,
      priorViews,
      priorClicks,
    ] = await Promise.all([
      countSince(newsletterSubscribers, newsletterSubscribers.createdAt, windowStart, null),
      countSince(postViews, postViews.viewedAt, windowStart, null),
      countSince(linkClicks, linkClicks.clickedAt, windowStart, null),
      days ? countSince(newsletterSubscribers, newsletterSubscribers.createdAt, priorStart, windowStart) : Promise.resolve(0),
      days ? countSince(postViews, postViews.viewedAt, priorStart, windowStart) : Promise.resolve(0),
      days ? countSince(linkClicks, linkClicks.clickedAt, priorStart, windowStart) : Promise.resolve(0),
    ]);

    // Daily series for sparklines — always last min(days, 90) days, default 30 for "All".
    const sparkDays = days ?? 30;
    const sparkStart = new Date(now.getTime() - sparkDays * 86_400_000);

    const dailyFor = async (table: any, col: any) => {
      const rows = await db
        .select({
          date: sql<string>`DATE_TRUNC('day', ${col})::date::text`,
          count: count(),
        })
        .from(table)
        .where(gte(col, sparkStart))
        .groupBy(sql`DATE_TRUNC('day', ${col})`)
        .orderBy(sql`DATE_TRUNC('day', ${col})`);
      return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
    };

    const [dailySubs, dailyViews, dailyClicks] = await Promise.all([
      dailyFor(newsletterSubscribers, newsletterSubscribers.createdAt),
      dailyFor(postViews, postViews.viewedAt),
      dailyFor(linkClicks, linkClicks.clickedAt),
    ]);

    return {
      totalSubscribers: Number(total),
      postViews: viewRows.map((r) => ({
        postId: r.postId ?? 0,
        title: r.title ?? "Unknown",
        views: Number(r.views),
      })),
      linkClicks: clickRows.map((r) => ({
        url: r.url,
        count: Number(r.count),
        sourcePage: r.sourcePage ?? null,
      })),
      memberSources: sourceRows.map((r) => ({
        referrer: r.referrer ?? "direct",
        count: Number(r.count),
      })),
      landingPaths: landingPathRows.map((r) => ({
        landingPath: r.landingPath ?? "—",
        count: Number(r.count),
      })),
      utmSources: utmSourceRows.map((r) => ({
        utmSource: r.utmSource ?? "—",
        count: Number(r.count),
      })),
      window: {
        days: days ?? null,
        subscribers: windowSubs,
        postViews: windowViews,
        linkClicks: windowClicks,
        prior: { subscribers: priorSubs, postViews: priorViews, linkClicks: priorClicks },
      },
      daily: {
        subscribers: dailySubs,
        postViews: dailyViews,
        linkClicks: dailyClicks,
      },
    };
  }
}

export const storage = new DatabaseStorage();
