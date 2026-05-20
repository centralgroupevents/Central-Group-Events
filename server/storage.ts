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
} from "@shared/schema";
import { eq, desc, sql, count, and, isNull, gte, inArray } from "drizzle-orm";
import slugifyLib from "slugify";
import { regionSection, normalizeRegion } from "@shared/region";

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

  importSubscribers(rows: Array<{ email: string; region?: string }>): Promise<{ imported: number; skipped: number }>;
  deleteSubscriber(id: number): Promise<void>;

  // Bookings
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBookings(): Promise<Booking[]>;
  updateBookingStatus(id: number, status: string): Promise<Booking | undefined>;
  updateBookingNotes(id: number, adminNotes: string): Promise<Booking | undefined>;
  batchDeleteBookings(ids: number[]): Promise<void>;

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
  recordClick(url: string, postId?: number, sourcePage?: string): Promise<void>;
  getClickStats(): Promise<{ url: string; count: number }[]>;

  // Comments
  getCommentsByPost(postId: number): Promise<Comment[]>;
  createComment(data: InsertComment): Promise<Comment>;

  // Analytics
  getAnalytics(): Promise<{
    totalSubscribers: number;
    postViews: { postId: number; title: string; views: number }[];
    linkClicks: { url: string; count: number; sourcePage: string | null }[];
    memberSources: { referrer: string; count: number }[];
  }>;
}

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

  async importSubscribers(rows: Array<{ email: string; region?: string }>): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      const email = row.email.trim().toLowerCase();
      const name = email.split("@")[0] || email;
      try {
        const result = await db
          .insert(newsletterSubscribers)
          .values({ email, name, region: row.region || "All" })
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
    const [newBooking] = await db.insert(promotionBookings).values(booking).returning();
    return newBooking;
  }

  async getBookings(): Promise<Booking[]> {
    return await db.select().from(promotionBookings).orderBy(desc(promotionBookings.createdAt));
  }

  async updateBookingStatus(id: number, status: string): Promise<Booking | undefined> {
    const [updated] = await db
      .update(promotionBookings)
      .set({ status })
      .where(eq(promotionBookings.id, id))
      .returning();
    return updated;
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
    await db.delete(events).where(eq(events.id, id));
  }

  async bulkDeleteEvents(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await db.delete(events).where(inArray(events.id, ids));
  }

  async bulkImportEvents(
    rows: InsertEvent[],
  ): Promise<{ imported: number; duplicates: { title: string; existingId: number; existingDate: string }[] }> {
    let imported = 0;
    const duplicates: { title: string; existingId: number; existingDate: string }[] = [];
    for (const row of rows) {
      // Match on title + date so two events with the same name on different dates aren't treated as dupes.
      const existing = await db
        .select({ id: events.id, date: events.date })
        .from(events)
        .where(and(eq(events.title, row.title), eq(events.date, row.date)))
        .limit(1);
      if (existing.length > 0) {
        duplicates.push({ title: row.title, existingId: existing[0].id, existingDate: existing[0].date });
      } else {
        const normalized = { ...row, region: normalizeRegion(row.region) || row.region };
        await db.insert(events).values(normalized);
        imported++;
      }
    }
    return { imported, duplicates };
  }

  // ── Pages ─────────────────────────────────────────────────────────────

  async getPageBySlug(slug: string): Promise<Page | null> {
    const rows = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
    return rows[0] || null;
  }

  async upsertPage(slug: string, data: Partial<InsertPage>): Promise<Page> {
    const existing = await this.getPageBySlug(slug);
    if (existing) {
      const [updated] = await db
        .update(pages)
        .set({ ...data, slug, updatedAt: new Date() })
        .where(eq(pages.slug, slug))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(pages)
      .values({ slug, title: data.title ?? "", editorContent: data.editorContent ?? "", ...data })
      .returning();
    return created;
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

  async recordClick(url: string, postId?: number, sourcePage?: string): Promise<void> {
    await db.insert(linkClicks).values({
      url,
      postId: postId ?? null,
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

  // ── Analytics ─────────────────────────────────────────────────────────

  async getAnalytics() {
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
    };
  }
}

export const storage = new DatabaseStorage();
