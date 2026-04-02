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
} from "@shared/schema";
import { eq, desc, sql, count, and, isNull } from "drizzle-orm";
import slugifyLib from "slugify";

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
  upsertSubscriber(email: string, referrer?: string): Promise<{ subscriber: Subscriber; isNew: boolean }>;

  importSubscribers(rows: Array<{ email: string; region?: string }>): Promise<{ imported: number; skipped: number }>;

  // Bookings
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBookings(): Promise<Booking[]>;
  updateBookingStatus(id: number, status: string): Promise<Booking | undefined>;

  // Events
  getEvents(region?: string): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, event: Partial<InsertEvent>): Promise<Event>;
  deleteEvent(id: number): Promise<void>;
  bulkImportEvents(rows: InsertEvent[]): Promise<{ imported: number; skipped: number }>;

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
  recordClick(url: string, postId?: number): Promise<void>;
  getClickStats(): Promise<{ url: string; count: number }[]>;

  // Comments
  getCommentsByPost(postId: number): Promise<Comment[]>;
  createComment(data: InsertComment): Promise<Comment>;

  // Analytics
  getAnalytics(): Promise<{
    totalSubscribers: number;
    postViews: { postId: number; title: string; views: number }[];
    linkClicks: { url: string; count: number }[];
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
      try {
        const result = await db
          .insert(newsletterSubscribers)
          .values({ email: row.email, region: row.region || "All" })
          .onConflictDoNothing()
          .returning();
        if (result.length > 0) {
          imported++;
        } else {
          skipped++;
        }
      } catch {
        skipped++;
      }
    }
    return { imported, skipped };
  }

  async upsertSubscriber(email: string, referrer?: string): Promise<{ subscriber: Subscriber; isNew: boolean }> {
    const existing = await this.findSubscriberByEmail(email);
    if (existing) {
      return { subscriber: existing, isNew: false };
    }
    const [created] = await db.insert(newsletterSubscribers).values({
      email,
      name: email.split("@")[0],
      region: "All",
      referrer: referrer || null,
      hasAccess: true,
    }).returning();
    return { subscriber: created, isNew: true };
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

  // ── Events ────────────────────────────────────────────────────────────

  async getEvents(region?: string): Promise<Event[]> {
    if (region && region !== "All") {
      return await db.select().from(events).where(eq(events.region, region));
    }
    return await db.select().from(events);
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db.insert(events).values(event).returning();
    return newEvent;
  }

  async updateEvent(id: number, data: Partial<InsertEvent>): Promise<Event> {
    const [updated] = await db.update(events).set(data).where(eq(events.id, id)).returning();
    return updated;
  }

  async deleteEvent(id: number): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }

  async bulkImportEvents(rows: InsertEvent[]): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      const existing = await db.select({ id: events.id }).from(events).where(
        eq(events.title, row.title)
      ).limit(1);
      if (existing.length > 0) {
        skipped++;
      } else {
        await db.insert(events).values(row);
        imported++;
      }
    }
    return { imported, skipped };
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

  async recordClick(url: string, postId?: number): Promise<void> {
    await db.insert(linkClicks).values({ url, postId: postId ?? null });
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
      })),
      memberSources: sourceRows.map((r) => ({
        referrer: r.referrer ?? "direct",
        count: Number(r.count),
      })),
    };
  }
}

export const storage = new DatabaseStorage();
