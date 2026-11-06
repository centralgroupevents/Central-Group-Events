// Build to Last — brand assets for emails: partner logos and speaker photos.
//
// Every image ships INSIDE the email as an inline (CID) attachment so it
// renders in Gmail & co. without depending on the website hosting it. Files
// live in client/public (served from dist/public after a build). An asset
// whose file isn't on disk is skipped (no broken-image icon): drop
// "equal-space-logo.png" into client/public and it appears everywhere.

import fs from "fs";
import path from "path";
import { EMBEDDED_BRAND_ASSETS } from "./btl-embedded-assets";

export const CGE_LOGO_CID = "cge-logo";
export const AISLEGO_LOGO_CID = "aislego-logo";
export const EQUAL_SPACE_LOGO_CID = "equal-space-logo";

/** Panelists for Vol. 1 — pre-filled so the speaker emails work out of the
 *  box. Admin → Build to Last → Settings overrides these once saved. */
export const BTL_SPEAKER_DEFAULTS: Array<{ name: string; credential: string; topic: string }> = [
  { name: "Alnazir Blackman", credential: "Owner, Blackman Realty", topic: "" },
  { name: "TC Cuthbertson", credential: "Founder & CEO, AisleGo", topic: "" },
  { name: "Tammy Holloway, CIGI", credential: "Special Agent, US Dept of Defense", topic: "" },
  { name: "Kimberly Simone", credential: "Lawyer", topic: "" },
];

/** Public LinkedIn pages for the panelists, keyed by photo slug. */
const SPEAKER_LINKEDIN: Record<string, string> = {
  "alnazir-blackman": "https://www.linkedin.com/in/blackmanrealty",
  "tc-cuthbertson": "https://www.linkedin.com/in/tc-cuthbertson-598b2032",
  "tammy-holloway": "https://www.linkedin.com/in/tammy-holloway-cigi-39813914a",
  "kimberly-simone": "https://www.linkedin.com/in/kimberly-mckoy-9a54901a5",
};

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** "Tammy Holloway, CIGI" → "tammy-holloway" (credentials after a comma dropped). */
export function speakerSlug(name: string): string {
  return name
    .split(",")[0]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Writes any embedded brand image that isn't already in the public folder
 * (so emails can attach it and the site can serve it). Run at server start.
 * A real file in client/public / dist/public is never overwritten.
 */
export function ensureBrandAssets(): void {
  const root = ["dist/public", "client/public"].map((r) => path.resolve(process.cwd(), r)).find((r) => fs.existsSync(r));
  if (!root) return;
  for (const [rel, b64] of Object.entries(EMBEDDED_BRAND_ASSETS)) {
    const target = path.join(root, rel);
    if (fs.existsSync(target)) continue;
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, Buffer.from(b64, "base64"));
    } catch (err) {
      console.error(`[btl-brand] could not write ${rel}:`, err instanceof Error ? err.message : err);
    }
  }
}

/** Absolute path of a file in the public folder, or null if it isn't there. */
export function publicFile(rel: string): string | null {
  for (const root of ["dist/public", "client/public"]) {
    const p = path.resolve(process.cwd(), root, rel);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** cid → public-relative file, for every image an email can carry. */
export function cidToPublicPath(cid: string): string | null {
  if (cid === CGE_LOGO_CID) return "cge-logo.png";
  if (cid === AISLEGO_LOGO_CID) return "aislego-logo.png";
  if (cid === EQUAL_SPACE_LOGO_CID) return "equal-space-logo.png";
  const m = /^speaker-([a-z0-9-]+)$/.exec(cid);
  if (m) return `speakers/${m[1]}.jpg`;
  return null;
}

export interface InlineAttachment {
  filename: string;
  path: string;
  cid: string;
  contentDisposition: "inline";
}

/**
 * Backs every `cid:` image in the html with its file. Images whose file is
 * missing are removed so no email ever shows a broken-image icon.
 */
export function inlineImages(html: string): { html: string; attachments: InlineAttachment[] } {
  const cids = Array.from(new Set(Array.from(html.matchAll(/cid:([a-z0-9-]+)/g), (m) => m[1])));
  const attachments: InlineAttachment[] = [];
  let out = html;
  for (const cid of cids) {
    const rel = cidToPublicPath(cid);
    const file = rel ? publicFile(rel) : null;
    if (file) {
      attachments.push({ filename: path.basename(file), path: file, cid, contentDisposition: "inline" });
    } else {
      out = out.replace(new RegExp(`<img[^>]*cid:${cid}[^>]*>`, "g"), "");
    }
  }
  return { html: out, attachments };
}

/** Browser previews can't resolve cid:, so point each at the served file. */
export function cidsToUrls(html: string, base: string): string {
  return html.replace(/cid:([a-z0-9-]+)/g, (m, cid: string) => {
    const rel = cidToPublicPath(cid);
    return rel ? `${base}/${rel}` : m;
  });
}

/**
 * "Meet the panel" block for {{speaker_cards}}: a round photo, the name,
 * the credential, and a LinkedIn link per panelist. A panelist without a
 * photo on disk gets a gold monogram instead.
 */
export function speakerCardsHtml(speakers: Array<{ name: string; credential: string; topic?: string }>): string {
  const rows = speakers
    .filter((s) => s.name.trim())
    .map((s) => {
      const slug = speakerSlug(s.name);
      const hasPhoto = !!publicFile(`speakers/${slug}.jpg`);
      const linkedin = SPEAKER_LINKEDIN[slug];
      const initials = s.name.split(",")[0].trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
      const photo = hasPhoto
        ? `<img src="cid:speaker-${slug}" alt="${esc(s.name)}" width="72" height="72" style="display:block;width:72px;height:72px;border-radius:36px;object-fit:cover;border:0" />`
        : `<div style="width:72px;height:72px;border-radius:36px;background:#e9dcc0;color:#8a6d3b;font:bold 22px/72px Arial,Helvetica,sans-serif;text-align:center">${esc(initials)}</div>`;
      const topic = s.topic?.trim() ? `<div style="font-size:14px;color:#6b5f48;font-style:italic">on ${esc(s.topic.trim())}</div>` : "";
      const link = linkedin
        ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px"><a href="${linkedin}" style="color:#8a6d3b">LinkedIn</a></div>`
        : "";
      return `<tr>
        <td width="86" valign="middle" style="padding:0 0 14px">${photo}</td>
        <td valign="middle" style="padding:0 0 14px">
          <div style="font-size:17px;font-weight:bold;line-height:1.3;color:#262118">${esc(s.name)}</div>
          <div style="font-size:14px;line-height:1.4;color:#4a4130">${esc(s.credential)}</div>
          ${topic}${link}
        </td>
      </tr>`;
    })
    .join("");
  if (!rows) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px">${rows}</table>`;
}

/**
 * Closing row of every email: Executive Sponsor (AisleGo) and the venue
 * (Equal Space). A partner whose logo file isn't on disk is shown as plain
 * text so the credit is never lost.
 */
export function partnersFooterHtml(): string {
  const cell = (cid: string, file: string, alt: string, label: string, w: number) =>
    publicFile(file)
      ? `<td align="center" valign="middle" style="padding:0 18px"><img src="cid:${cid}" alt="${alt}" height="44" style="display:block;height:44px;width:auto;max-width:${w}px;margin:0 auto 6px;border:0" /><div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:#9a917f">${label}</div></td>`
      : `<td align="center" valign="middle" style="padding:0 18px"><div style="font-size:15px;font-weight:bold;color:#262118">${alt}</div><div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:#9a917f">${label}</div></td>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:34px auto 0;border-top:1px solid #e6dcc6;padding-top:22px"><tr>
    ${cell(AISLEGO_LOGO_CID, "aislego-logo.png", "AisleGo", "Executive Sponsor", 90)}
    ${cell(EQUAL_SPACE_LOGO_CID, "equal-space-logo.png", "Equal Space", "Venue partner", 150)}
  </tr></table>`;
}
