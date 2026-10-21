// Build to Last mailer — one narrow interface over the delivery provider.
//
// Vol. 1 sends through the site's existing Gmail transport (From:
// "Anthony from Central Group Events" <GMAIL_USER>), which keeps every
// email threading like a personal note from the real inbox. If a future
// volume outgrows Gmail (~500 recipients/day), swap the transport inside
// sendBtlEmail for Resend — nothing outside this module changes, but note
// Resend cannot send as an @gmail.com address (needs a verified domain).

import nodemailer from "nodemailer";
import { storage } from "./storage";
import { signToken } from "./email-compliance";
import { btlShell, BTL_FROM_NAME, BTL_SLUG } from "./btl-emails";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export function btlSiteBase(): string {
  return process.env.PUBLIC_SITE_URL || "https://centralgroupevents.com";
}

export function btlRsvpUrl(src?: string): string {
  return `${btlSiteBase()}/build-to-last${src ? `?src=${encodeURIComponent(src)}` : ""}`;
}

export function btlUnsubscribeUrl(email: string): string {
  const e = Buffer.from(email.toLowerCase().trim()).toString("base64url");
  return `${btlSiteBase()}/api/build-to-last/unsubscribe?e=${e}&t=${signToken(email)}`;
}

export interface BtlRecipient {
  email: string;
  rsvpId?: number | null;
  inviteeId?: number | null;
}

/**
 * Send one cadence email with the dedup gate and the send log built in.
 * Returns "sent" | "skipped" (already sent before) | "failed".
 */
export async function deliverBtlEmail(
  recipient: BtlRecipient,
  templateKey: string,
  tpl: { subject: string; body: string },
): Promise<"sent" | "skipped" | "failed"> {
  const email = recipient.email.toLowerCase().trim();
  if (await storage.hasBtlEmailSend(BTL_SLUG, email, templateKey)) {
    return "skipped";
  }
  const html = btlShell(tpl.body, btlUnsubscribeUrl(email));
  try {
    await transporter.sendMail({
      from: `"${BTL_FROM_NAME}" <${process.env.GMAIL_USER}>`,
      to: email,
      replyTo: "centralgroupevents@gmail.com",
      subject: tpl.subject,
      html,
    });
    await storage.recordBtlEmailSend({
      eventSlug: BTL_SLUG,
      rsvpId: recipient.rsvpId ?? null,
      inviteeId: recipient.inviteeId ?? null,
      recipientEmail: email,
      templateKey,
      status: "sent",
    });
    return "sent";
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 400) : "unknown";
    await storage.recordBtlEmailSend({
      eventSlug: BTL_SLUG,
      rsvpId: recipient.rsvpId ?? null,
      inviteeId: recipient.inviteeId ?? null,
      recipientEmail: email,
      templateKey,
      status: "failed",
      errorMessage: msg,
    }).catch(() => {});
    console.error(`[btl-mailer] ${templateKey} → ${email} failed:`, msg);
    return "failed";
  }
}

/** Pause between bulk sends — stays inside Gmail's burst limits. */
export function btlSendPause(): Promise<void> {
  return new Promise((r) => setTimeout(r, 350));
}

// Event settings with sane defaults; every value overridable from admin via
// app_settings keys ("btl.<field>").
export interface BtlSettings {
  /** Sponsor sign-up link (e.g. the AisleGo listing). When set, every
   *  {{rsvp_url}} in the emails points here instead of /build-to-last. */
  rsvpUrl: string;
  venueName: string;
  venueAddress: string;
  doorsTime: string;
  programStartTime: string;
  questionThemes: string;
  speakers: Array<{ name: string; credential: string; topic: string }>;
  photoGalleryUrl: string;
  recapVideoUrl: string;
  fieldNotesUrl: string;
  contactSheetUrl: string;
}

const BTL_DEFAULTS: BtlSettings = {
  rsvpUrl: "",
  venueName: "Equal Space",
  venueAddress: "Equal Space, Newark, NJ",
  doorsTime: "6:00 PM",
  programStartTime: "6:45 PM",
  questionThemes: "",
  speakers: [],
  photoGalleryUrl: "",
  recapVideoUrl: "",
  fieldNotesUrl: "",
  contactSheetUrl: "",
};

export async function getBtlSettings(): Promise<BtlSettings> {
  const out: BtlSettings = { ...BTL_DEFAULTS };
  const stringKeys: Array<keyof BtlSettings> = [
    "rsvpUrl", "venueName", "venueAddress", "doorsTime", "programStartTime",
    "questionThemes", "photoGalleryUrl", "recapVideoUrl", "fieldNotesUrl", "contactSheetUrl",
  ];
  for (const key of stringKeys) {
    const v = await storage.getSetting(`btl.${key}`);
    if (v !== null && v !== "") (out as any)[key] = v;
  }
  const speakersRaw = await storage.getSetting("btl.speakers");
  if (speakersRaw) {
    try {
      const parsed = JSON.parse(speakersRaw);
      if (Array.isArray(parsed)) out.speakers = parsed;
    } catch { /* keep default */ }
  }
  return out;
}
