import crypto from "crypto";

// ── Email marketing compliance helpers ────────────────────────────────
//
// Everything the CAN-SPAM Act + Gmail/Yahoo bulk-sender rules require on
// outbound marketing email lives here:
//   • signed unsubscribe links (HMAC of the recipient email, so links can't
//     be forged to unsubscribe other people, and no token column is needed)
//   • RFC 8058 one-click List-Unsubscribe headers
//   • a standard footer with the sender's physical postal address, an
//     explanation of why the recipient is getting the email, and a working
//     unsubscribe link

function siteBase(): string {
  return process.env.PUBLIC_SITE_URL || "https://centralgroupevents.com";
}

// CAN-SPAM §5(a)(5) requires a valid physical postal address (a PO box or
// registered commercial mail-receiving agency address is fine) in every
// marketing email. Set EMAIL_POSTAL_ADDRESS in the environment.
export function postalAddress(): string {
  return process.env.EMAIL_POSTAL_ADDRESS || "Central Group Events, New Jersey, USA";
}

function unsubscribeSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.SESSION_SECRET || process.env.GMAIL_APP_PASSWORD;
  if (!secret) {
    console.warn("[email-compliance] WARNING: no UNSUBSCRIBE_SECRET / SESSION_SECRET set — unsubscribe links will not validate across restarts.");
    return "cge-unsubscribe-fallback";
  }
  return secret;
}

export function unsubscribeToken(email: string): string {
  return crypto
    .createHmac("sha256", unsubscribeSecret())
    .update(email.toLowerCase().trim())
    .digest("base64url")
    .slice(0, 32);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  if (!token) return false;
  const expected = unsubscribeToken(email);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function encodeEmail(email: string): string {
  return Buffer.from(email.toLowerCase().trim()).toString("base64url");
}

export function decodeEmail(b64: string): string {
  try {
    return Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

/** Human-facing unsubscribe page (client route) with signed params. */
export function unsubscribeUrl(email: string): string {
  return `${siteBase()}/unsubscribe?e=${encodeEmail(email)}&t=${unsubscribeToken(email)}`;
}

/** Direct API endpoint used by one-click (RFC 8058) POSTs. */
export function unsubscribeApiUrl(email: string): string {
  return `${siteBase()}/api/unsubscribe?e=${encodeEmail(email)}&t=${unsubscribeToken(email)}`;
}

/**
 * Headers for every bulk/marketing send. Gmail and Yahoo require
 * List-Unsubscribe + List-Unsubscribe-Post (one-click) from bulk senders;
 * without them deliverability drops and mail lands in spam.
 */
export function listUnsubscribeHeaders(email: string): Record<string, string> {
  const mailto = process.env.GMAIL_USER
    ? `, <mailto:${process.env.GMAIL_USER}?subject=unsubscribe>`
    : "";
  return {
    "List-Unsubscribe": `<${unsubscribeApiUrl(email)}>${mailto}`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/**
 * Standard compliance footer appended to every marketing email.
 * `reason` explains why the recipient is receiving it (CAN-SPAM best
 * practice, and required for sends to non-newsletter lists like page
 * submitters).
 */
export function complianceFooter(email: string, reason: string, opts?: { dark?: boolean }): string {
  const dark = opts?.dark !== false;
  const muted = dark ? "#777777" : "#999999";
  const link = "#8B2FC9";
  const border = dark ? "#333333" : "#eeeeee";
  return `
    <hr style="border:none;border-top:1px solid ${border};margin:32px 0 16px;" />
    <p style="color:${muted};font-size:12px;line-height:1.6;text-align:center;margin:0 0 8px;">
      ${reason}<br/>
      <a href="${unsubscribeUrl(email)}" style="color:${link};text-decoration:underline;">Unsubscribe instantly</a>
      &nbsp;·&nbsp;
      <a href="${siteBase()}/legal/privacy" style="color:${link};text-decoration:underline;">Privacy Policy</a>
    </p>
    <p style="color:${muted};font-size:11px;text-align:center;margin:0;">
      Central Group Events · ${postalAddress()}
    </p>`;
}
