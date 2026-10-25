// Build to Last — scheduled cadence engine.
//
// The trigger map lives here as code: each template knows when it goes out
// (ET, overridable via app_settings "btl.sendAt.<key>") and to whom. The
// daily/hourly cron tick calls runBtlCadenceTick(); dedup lives in
// event_email_sends via deliverBtlEmail, so a tick can run as often as the
// cron fires without double-sending. Templates with manual inputs refuse to
// send until those inputs exist — reported as blockers, never half-sent.

import { storage } from "./storage";
import { BTL_SLUG, btlTemplateDef, renderBtlText, paras } from "./btl-emails";
import { BTL_INTEREST_KEYS, BTL_INTEREST_LABELS } from "@shared/schema";
import { deliverBtlEmail, btlRsvpUrl, btlSendPause, getBtlSettings, type BtlSettings } from "./btl-mailer";
import { signToken, encodeEmail } from "./email-compliance";
import type { EventRsvp, EventInvitee } from "@shared/schema";

// "YYYY-MM-DDTHH:mm" meant as America/New_York wall time → UTC Date.
// Two-pass offset correction handles DST (Nov 1 2026 falls back mid-cadence).
export function etToUtc(local: string): Date {
  const [datePart, timePart] = local.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = (timePart || "00:00").split(":").map(Number);
  let guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  for (let i = 0; i < 2; i++) {
    const read = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(guess);
    const get = (t: string) => Number(read.find((p) => p.type === t)?.value ?? 0);
    const readUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
    const wantUtc = Date.UTC(y, m - 1, d, hh, mm);
    guess = new Date(guess.getTime() + (wantUtc - readUtc));
  }
  return guess;
}

export type BtlAudience = "rsvps" | "invitees_second_wave" | "invitees_all" | "invitees_nudge" | "checked_in";

export interface BtlCadenceEntry {
  key: string;
  label: string;
  audience: BtlAudience | "manual";
  /** ET wall time; null = manual-only (never auto-fires). */
  defaultSendAtEt: string | null;
  /** Settings keys that must be non-empty before this template may send. */
  requiresSettings?: Array<keyof BtlSettings>;
}

export const BTL_CADENCE: BtlCadenceEntry[] = [
  { key: "initial_invite", label: "Initial invites", audience: "manual", defaultSendAtEt: null },
  { key: "guest_info", label: "Thank you + what you want out of the night", audience: "invitees_all", defaultSendAtEt: null },
  // Evaluated every tick (send-at is in the past); the audience filter only
  // admits invitees whose initial invite is 24h+ old with no RSVP, and the
  // send log keeps it to one nudge per person.
  { key: "nudge_1d", label: "RSVP nudge (24h, no response)", audience: "invitees_nudge", defaultSendAtEt: "2026-10-01T00:00" },
  { key: "touch_4", label: "What this room is coming for", audience: "rsvps", defaultSendAtEt: "2026-10-29T10:00" },
  { key: "touch_5", label: "Second wave (non-responders)", audience: "invitees_second_wave", defaultSendAtEt: "2026-10-31T10:00" },
  { key: "touch_6", label: "Who's going to be in the room", audience: "rsvps", defaultSendAtEt: "2026-11-02T10:00" },
  { key: "touch_7", label: "Speaker announcement", audience: "rsvps", defaultSendAtEt: "2026-11-04T10:00", requiresSettings: ["speakers"] },
  { key: "touch_8", label: "Four days out", audience: "rsvps", defaultSendAtEt: "2026-11-08T10:00" },
  { key: "touch_9", label: "Tomorrow", audience: "rsvps", defaultSendAtEt: "2026-11-11T17:00" },
  { key: "followup_48h", label: "48h follow-up (attendees)", audience: "checked_in", defaultSendAtEt: "2026-11-14T10:00", requiresSettings: ["photoGalleryUrl"] },
];

export async function btlSendAtFor(key: string): Promise<string | null> {
  const entry = BTL_CADENCE.find((c) => c.key === key);
  if (!entry) return null;
  const override = await storage.getSetting(`btl.sendAt.${key}`);
  return override || entry.defaultSendAtEt;
}

function missingSettings(entry: BtlCadenceEntry, settings: BtlSettings): string[] {
  return (entry.requiresSettings ?? []).filter((k) => {
    const v = settings[k];
    return Array.isArray(v) ? v.length === 0 : !String(v ?? "").trim();
  });
}

// Auto-generated "{{category_breakdown}}" from admin-assigned categories.
export function categoryBreakdown(rsvps: EventRsvp[]): string {
  const counts: Record<string, number> = {};
  for (const r of rsvps) {
    if (r.adminCategory) counts[r.adminCategory] = (counts[r.adminCategory] ?? 0) + 1;
  }
  const lines: string[] = [];
  if (counts.venue_owner) lines.push(`- ${counts.venue_owner} venue owner${counts.venue_owner !== 1 ? "s" : ""} (downtown + Ironbound)`);
  if (counts.planner) lines.push(`- ${counts.planner} planner${counts.planner !== 1 ? "s" : ""} across events, weddings, and corporate work`);
  if (counts.dj) lines.push(`- ${counts.dj} of Newark's most-booked DJs`);
  if (counts.influencer) lines.push(`- ${counts.influencer} influencer${counts.influencer !== 1 ? "s" : ""} across fashion, beauty, and lifestyle`);
  if (counts.institutional || counts.other) lines.push("- A handful of folks from Newark's institutional creative ecosystem");
  return lines.length > 0 ? lines.join("\n") : "- A room of planners, DJs, venue owners, and operators who are actually building";
}

export interface BtlRenderCtx {
  settings: BtlSettings;
  confirmedCount: number;
  breakdown: string;
  interestsBreakdown: string;
}

export interface BtlTemplateTexts {
  subject: string;
  body: string;
  customized: boolean;
}

/** Current subject/body for a template: the admin's saved edit if one
 *  exists ("btl.tpl.<key>.subject" / ".body" in app_settings), otherwise
 *  the code default. An empty stored value means "not customized". */
export async function getBtlTemplateTexts(key: string): Promise<BtlTemplateTexts | null> {
  const def = btlTemplateDef(key);
  if (!def) return null;
  const subject = (await storage.getSetting(`btl.tpl.${key}.subject`)) || "";
  const body = (await storage.getSetting(`btl.tpl.${key}.body`)) || "";
  return {
    subject: subject.trim() || def.subject,
    body: body.trim() || def.body,
    customized: !!(subject.trim() || body.trim()),
  };
}

/** Every placeholder, for every template — a recipient-specific map fed to
 *  renderBtlText. Unknown placeholders typed into an edited template stay
 *  visible in the preview instead of silently disappearing. */
export function buildBtlVars(
  recipient: { name: string; email?: string; contactSheetOptin?: boolean },
  ctx: BtlRenderCtx,
): Record<string, string> {
  const s = ctx.settings;
  const contactSheetLine = recipient.contactSheetOptin && s.contactSheetUrl
    ? `Attendee contact sheet (those who opted in): ${s.contactSheetUrl}`
    : "";
  const speakerLineup = s.speakers
    .map((sp) => `- ${sp.name}, ${sp.credential} — on ${sp.topic}`)
    .join("\n");
  return {
    name: recipient.name,
    first_name: recipient.name.trim().split(/\s+/)[0] || recipient.name,
    // Personalized when we know the recipient: the signed identity prefills
    // the RSVP form (no typing) and lets us record exactly who opened their
    // link. A sponsor rsvpUrl (external ticketing) can't carry our token,
    // so it wins untouched when set.
    rsvp_url: s.rsvpUrl.trim()
      || (recipient.email
        ? `${btlRsvpUrl("invite")}&e=${encodeEmail(recipient.email)}&t=${signToken(recipient.email)}&n=${encodeURIComponent(recipient.name)}`
        : btlRsvpUrl("invite")),
    // Personalized: carries a signed identity so the questions form skips
    // name/email for people we already know (AisleGo sign-ups, invitees).
    questions_url: recipient.email
      ? `${btlRsvpUrl("q")}&e=${encodeEmail(recipient.email)}&t=${signToken(recipient.email)}&n=${encodeURIComponent(recipient.name)}`
      : btlRsvpUrl("q"),
    venue_name: s.venueName,
    venue_address: s.venueAddress,
    doors_time: s.doorsTime,
    program_start_time: s.programStartTime,
    confirmed_count: String(ctx.confirmedCount),
    question_themes: s.questionThemes,
    category_breakdown: ctx.breakdown,
    interests_breakdown: ctx.interestsBreakdown,
    speaker_lineup: speakerLineup,
    photo_gallery_url: s.photoGalleryUrl,
    recap_video_url: s.recapVideoUrl,
    field_notes_url: s.fieldNotesUrl,
    contact_sheet_line: contactSheetLine,
  };
}

/** Substitute one recipient into resolved template texts. The returned
 *  body is rendered HTML (paragraphs, section headers, bullet lists via
 *  paras) — ready for btlShell. */
export function renderBtlFromTexts(
  texts: BtlTemplateTexts,
  recipient: { name: string; email?: string; contactSheetOptin?: boolean },
  ctx: BtlRenderCtx,
): { subject: string; body: string } {
  const vars = buildBtlVars(recipient, ctx);
  return {
    subject: renderBtlText(texts.subject, vars),
    body: paras(renderBtlText(texts.body, vars)),
  };
}

export async function renderBtlTemplate(
  key: string,
  recipient: { name: string; email?: string; contactSheetOptin?: boolean },
  ctx: BtlRenderCtx,
): Promise<{ subject: string; body: string } | null> {
  const texts = await getBtlTemplateTexts(key);
  if (!texts) return null;
  return renderBtlFromTexts(texts, recipient, ctx);
}

async function resolveAudience(audience: BtlAudience): Promise<Array<{ name: string; email: string; rsvpId?: number; inviteeId?: number; contactSheetOptin?: boolean }>> {
  if (audience === "rsvps") {
    const rows = await storage.listBtlRsvps(BTL_SLUG);
    return rows.filter((r) => !r.unsubscribed).map((r) => ({ name: r.name, email: r.email, rsvpId: r.id, contactSheetOptin: r.contactSheetOptin }));
  }
  if (audience === "checked_in") {
    const rows = await storage.listBtlRsvps(BTL_SLUG);
    return rows.filter((r) => !r.unsubscribed && r.checkedInAt).map((r) => ({ name: r.name, email: r.email, rsvpId: r.id, contactSheetOptin: r.contactSheetOptin }));
  }
  if (audience === "invitees_nudge") {
    // Initial invite went out 24h+ ago, no RSVP yet, still pending.
    const invitees = await storage.listBtlInvitees(BTL_SLUG);
    const rsvps = await storage.listBtlRsvps(BTL_SLUG);
    const rsvpEmails = new Set(rsvps.map((r) => r.email));
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return invitees
      .filter((i: EventInvitee) =>
        !i.unsubscribed && i.rsvpStatus === "pending" && !rsvpEmails.has(i.email) &&
        !!i.initialInviteSentAt && new Date(i.initialInviteSentAt).getTime() <= dayAgo)
      .map((i) => ({ name: i.name, email: i.email, inviteeId: i.id }));
  }
  if (audience === "invitees_all") {
    const invitees = await storage.listBtlInvitees(BTL_SLUG);
    return invitees
      .filter((i: EventInvitee) => !i.unsubscribed && i.rsvpStatus !== "declined")
      .map((i) => ({ name: i.name, email: i.email, inviteeId: i.id }));
  }
  // invitees_second_wave: got the initial invite, never RSVP'd, not declined.
  const invitees = await storage.listBtlInvitees(BTL_SLUG);
  const rsvps = await storage.listBtlRsvps(BTL_SLUG);
  const rsvpEmails = new Set(rsvps.map((r) => r.email));
  return invitees
    .filter((i: EventInvitee) => !i.unsubscribed && i.rsvpStatus === "pending" && i.initialInviteSentAt && !rsvpEmails.has(i.email))
    .map((i) => ({ name: i.name, email: i.email, inviteeId: i.id }));
}

/** "{{interests_breakdown}}" — what the room says it wants, from RSVPs. */
export function interestsBreakdown(rsvps: EventRsvp[]): string {
  const counts = new Map<string, number>();
  for (const r of rsvps) {
    try {
      for (const k of JSON.parse(r.topicInterests || "[]")) {
        if ((BTL_INTEREST_KEYS as readonly string[]).includes(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    } catch { /* skip bad rows */ }
  }
  const lines = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => `- ${BTL_INTEREST_LABELS[k as keyof typeof BTL_INTEREST_LABELS]}`);
  return lines.length > 0 ? lines.join("\n") : "- New connections\n- Industry news & perspectives\n- Expanding networks statewide";
}

export async function buildBtlRenderCtx(): Promise<BtlRenderCtx> {
  const settings = await getBtlSettings();
  const rsvps = await storage.listBtlRsvps(BTL_SLUG);
  return { settings, confirmedCount: rsvps.length, breakdown: categoryBreakdown(rsvps), interestsBreakdown: interestsBreakdown(rsvps) };
}

/** Send one template to its audience right now (dedup makes this idempotent). */
export async function sendBtlTemplate(key: string): Promise<{ key: string; sent: number; skipped: number; failed: number; blocked?: string }> {
  const entry = BTL_CADENCE.find((c) => c.key === key);
  if (!entry || entry.audience === "manual") return { key, sent: 0, skipped: 0, failed: 0, blocked: "not a schedulable template" };
  const ctx = await buildBtlRenderCtx();
  const missing = missingSettings(entry, ctx.settings);
  if (missing.length > 0) {
    return { key, sent: 0, skipped: 0, failed: 0, blocked: `fill in ${missing.join(", ")} in Build to Last settings first` };
  }
  const texts = await getBtlTemplateTexts(key);
  if (!texts) return { key, sent: 0, skipped: 0, failed: 0, blocked: "unknown template" };
  const audience = await resolveAudience(entry.audience);
  let sent = 0, skipped = 0, failed = 0;
  for (const person of audience) {
    const tpl = renderBtlFromTexts(texts, person, ctx);
    const outcome = await deliverBtlEmail(person, key, tpl);
    if (outcome === "sent") { sent++; await btlSendPause(); }
    else if (outcome === "skipped") skipped++;
    else failed++;
  }
  return { key, sent, skipped, failed };
}

/** Cron hook: fire every scheduled template whose send-at has passed. */
export async function runBtlCadenceTick(): Promise<Array<{ key: string; sent: number; skipped: number; failed: number; blocked?: string }>> {
  const now = Date.now();
  const results: Array<{ key: string; sent: number; skipped: number; failed: number; blocked?: string }> = [];
  for (const entry of BTL_CADENCE) {
    if (entry.audience === "manual") continue;
    const sendAt = await btlSendAtFor(entry.key);
    if (!sendAt) continue;
    if (etToUtc(sendAt).getTime() > now) continue;
    try {
      const r = await sendBtlTemplate(entry.key);
      // Only surface rows that did something (or are blocked) — quiet
      // when everyone already got it.
      if (r.sent > 0 || r.failed > 0 || r.blocked) results.push(r);
    } catch (err) {
      results.push({ key: entry.key, sent: 0, skipped: 0, failed: 0, blocked: err instanceof Error ? err.message.slice(0, 200) : "unknown error" });
    }
  }
  return results;
}
