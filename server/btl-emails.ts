// Build to Last Vol. 1 — email templates.
//
// These are deliberately personal notes, not marketing emails: serif body,
// generous line-height, no header bars or logos, a plain unsubscribe line.
//
// Every template is plain text with {{placeholders}} — the defaults live
// here, and the admin can override any template's subject/body from the
// Build to Last → Templates view (stored in app_settings as
// "btl.tpl.<key>.subject" / "btl.tpl.<key>.body", resolved in btl-cadence).
// A line that is just "✦ SECTION TITLE" renders as a small gold section
// header; "✔" bullets and plain lines render as-is.

export const BTL_SLUG = "build-to-last-vol-1";
export const BTL_FROM_NAME = "Anthony from Central Group Events";

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// Plain multi-line text → escaped HTML paragraphs; bare URLs become links
// (HTML email clients don't auto-link the way plain-text ones do).
// Formatting rules, so edited templates keep looking right:
// - a single-line paragraph starting with "✦" → small gold section header
// - a paragraph whose lines all start with ✔ / • / - / "1." → a list with
//   hanging indents, so wrapped lines align under the text, not the marker
// - [text](url) → a link that reads "text" instead of the raw URL; a
//   paragraph that is ONLY such a link renders as a gold button
// - everything else → a normal paragraph; single line breaks become <br>
const BULLET_RE = /^(✔|✓|•|\*|-|\d+[.)])\s/;
const MD_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)<]+)\)/g;

function inline(line: string): string {
  // Stash [text](url) links first so the bare-URL pass can't re-wrap the
  // URL sitting inside the href.
  const stash: string[] = [];
  let s = esc(line).replace(MD_LINK_RE, (_m, label: string, url: string) => {
    stash.push(`<a href="${url}" style="color:#8a6d3b;font-weight:bold">${label}</a>`);
    return `\u0000${stash.length - 1}\u0000`;
  });
  s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#8a6d3b">$1</a>');
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => stash[Number(i)]);
}

export function paras(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => {
      if (p.startsWith("✦") && !p.includes("\n")) {
        return `<p style="margin:28px 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;font-weight:bold;letter-spacing:2.5px;color:#8a6d3b">${inline(p)}</p>`;
      }
      // A paragraph that is nothing but one [text](url) link → gold button.
      const btn = /^\[([^\]]+)\]\((https?:\/\/[^\s)<]+)\)$/.exec(p.replace(/\n/g, " ").trim());
      if (btn) {
        const [, label, url] = btn;
        return `<p style="margin:26px 0;text-align:center"><a href="${esc(url)}" style="display:inline-block;background:#c9a35c;color:#1b150a;padding:13px 40px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;border-radius:3px">${esc(label)}</a></p>`;
      }
      const lines = p.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length > 0 && lines.every((l) => BULLET_RE.test(l))) {
        const items = lines
          .map((l, i) => `<p style="margin:0 0 ${i === lines.length - 1 ? 0 : 8}px;padding-left:22px;text-indent:-22px">${inline(l)}</p>`)
          .join("\n");
        return `<div style="margin:0 0 18px">${items}</div>`;
      }
      return `<p style="margin:0 0 18px">${inline(p).replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");
}

// Substitute {{placeholder}} tokens. Unknown tokens are left visible so a
// typo shows up in the preview instead of silently vanishing. Placeholders
// that resolve to "" can leave an empty paragraph behind — collapse it.
export function renderBtlText(text: string, vars: Record<string, string>): string {
  return text
    .replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, key: string) => {
      const v = vars[key.toLowerCase()];
      return v === undefined ? match : v;
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// The shared shell: quiet, serif, personal. A small CGE wordmark up top,
// then the note; unsubscribeUrl renders as one plain line at the bottom —
// no marketing footer bars. The logo references a CID inline attachment
// (see cgeLogoAttachment in btl-mailer) so it displays without depending
// on the website hosting the image; previews swap the cid: for a URL.
export const CGE_LOGO_CID = "cge-logo";

export function btlShell(bodyHtml: string, unsubscribeUrl: string): string {
  return `
  <div style="background:#faf8f4;padding:28px 16px">
    <div style="max-width:560px;margin:0 auto;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.75;color:#262118">
      <img src="cid:${CGE_LOGO_CID}" alt="Central Group Events" width="96" height="22" style="display:block;width:96px;height:auto;margin:0 0 26px;border:0" />
      ${bodyHtml}
      <p style="margin:34px 0 0;color:#9a917f;font-size:12px;font-family:Georgia,serif">
        You're getting this because of Build to Last Vol. 1.
        <a href="${unsubscribeUrl}" style="color:#9a917f">Unsubscribe from these emails</a>.
      </p>
    </div>
  </div>`;
}

export interface BtlTemplateDef {
  key: string;
  label: string;
  /** Placeholders this template uses by default — shown as chips in the editor. All placeholders work in every template. */
  placeholders: string[];
  subject: string;
  body: string;
}

export const BTL_TEMPLATE_DEFS: BtlTemplateDef[] = [
  {
    key: "confirmation",
    label: "RSVP confirmation (instant)",
    placeholders: ["name", "first_name", "venue_name", "doors_time"],
    subject: "You're in — Build to Last, Nov 12",
    body: `Hey {{name}},

You're confirmed for Build to Last on Thursday, November 12th at {{venue_name}} in Newark. Doors open at {{doors_time}}.

We'll share more as the night gets closer — speakers, run of show, and everything else worth knowing.

Looking forward to having you in the room.

— Anthony
Founder, Central Group Events`,
  },
  {
    key: "initial_invite",
    label: "Initial invites",
    placeholders: ["name", "first_name", "rsvp_url", "venue_name", "doors_time", "program_start_time"],
    subject: "You're invited — Build to Last, Nov 12 in Newark",
    body: `Hey {{name}},

In about three weeks, we're hosting the first Build to Last — an invite-only mixer for the planners, venue owners, and creators we've met promoting events across New Jersey.

Promoting events across this state, we've come across so many influential, hardworking people who chose to curate spaces and places here — and who believe New Jersey is only going to present more opportunities for people like us. The best habit any of us can keep is an informed, active network that learns from one another. Build to Last is that habit, in person.

✦ WHAT TO EXPECT

✔ An intentionally set crowd — planners, venue owners, and creators from across the state
✔ Moderated conversations on event planning, spaces, and brand building in NJ
✔ A professionally photographed night — you'll get the photos after

✦ THE ESSENTIALS

✔ Open bar
✔ Small bites
✔ Programming + networking
✔ Free · RSVP required

✦ EVENT FLOW

{{doors_time}} — Doors open. Introductions and open bar.
{{program_start_time}} — Moderated conversations centered around event planning, spaces, and brand building in NJ
8:30 PM — Night cap

✦ THE DETAILS

Thursday, November 12 · {{venue_name}}, Newark
Dress code: come as yourself — we know plenty of you are coming straight from work. Business casual is perfect.

Your name is already on the list — RSVP takes one tap.

[RSVP here]({{rsvp_url}})

— Anthony
Founder, Central Group Events`,
  },
  {
    key: "nudge_1d",
    label: "RSVP nudge (24h, no response)",
    placeholders: ["name", "first_name", "rsvp_url", "venue_name", "doors_time"],
    subject: "Can I count you in? — Build to Last, Nov 12",
    body: `Hey {{name}},

Anthony from Central Group Events — floating my invite back to the top of your inbox.

In about three weeks, we're hosting Build to Last — an invite-only mixer for the planners, venue owners, and creators we've met promoting events across New Jersey. People who curate spaces and places here, and believe this state is only going to open up more for people like us.

Thursday, November 12 · {{doors_time}}–8:30 PM · {{venue_name}}, Newark. Open bar, small bites, a photographer on site, and moderated conversations mid-evening on event planning, spaces, and brand building in NJ.

It's free, and the room is set by invitation. I'd love to have you — can I count you in?

[RSVP here]({{rsvp_url}})

Your name's already on the list — just confirm and tell us what you're looking to get out of the night.

— Anthony
Founder, Central Group Events`,
  },
  {
    key: "guest_info",
    label: "Thank you + what you want out of the night",
    placeholders: ["name", "first_name", "questions_url", "rsvp_url"],
    subject: "Thank you — one quick tap",
    body: `Hey {{name}},

Thank you — whether you've locked in your spot for Build to Last on Thursday, November 12th or you're still figuring out if you can make it, I appreciate you considering the room.

One quick ask, one tap: tell us what you're most looking to walk away with that night — new connections, industry perspectives, collaborators, visibility. It helps us set the room and the conversations.

[Tell us here]({{questions_url}})

If it turns out you can't make it this time, no stress — you'll be first in line for the next one.

— Anthony
Founder, Central Group Events`,
  },
  {
    key: "touch_4",
    label: "What this room is coming for",
    placeholders: ["name", "interests_breakdown"],
    subject: "What this room is coming for",
    body: `Hey {{name}},

Quick update on Build to Last as we get closer.

The RSVPs have been coming in, and when we ask people what they're looking to walk away with, here's what this room says:

{{interests_breakdown}}

We're shaping the night around exactly that. See you November 12th.

— Anthony
Founder, Central Group Events`,
  },
  {
    key: "touch_5",
    label: "Second wave (non-responders)",
    placeholders: ["name", "confirmed_count", "rsvp_url"],
    subject: "Build to Last Nov 12 — closing invites soon",
    body: `Hey {{name}} —

Following up on the Build to Last invite from a couple weeks ago. The room is coming together — {{confirmed_count}} confirmed so far — and I'm starting to close invites in the next week or so to keep it intentional in size.

If Nov 12 works for you, I'd love to have you in the room. If it doesn't, totally understand — just let me know and I'll make sure you're first on the list for Vol. 2.

[RSVP here]({{rsvp_url}})

— Anthony`,
  },
  {
    key: "touch_6",
    label: "Who's going to be in the room",
    placeholders: ["name", "category_breakdown"],
    subject: "Who's going to be in the room",
    body: `Hey {{name}} —

Build to Last is 12 days out. Without naming names yet, here's who's confirmed so far:

{{category_breakdown}}

Speaker lineup lands in your inbox later this week.

If there's anyone specific you're hoping to meet in the room, hit reply and tell me — I'll make the introduction on the night.

— Anthony`,
  },
  {
    key: "touch_7",
    label: "Speaker announcement",
    placeholders: ["name", "speaker_lineup", "venue_name", "venue_address", "doors_time", "program_start_time"],
    subject: "Your Nov 12 speakers",
    body: `Hey {{name}} —

The lineup for Build to Last Vol. 1:

{{speaker_lineup}}

Format: four small-group conversation stations. You'll rotate through all four over the course of the night. Intimate, direct, every voice heard.

Logistics:

- {{venue_address}}
- Doors at {{doors_time}}
- Programming starts promptly at {{program_start_time}}
- Open bar and small bites throughout
- Light dress code: come as yourself, elevated

See you one week from Thursday.

— Anthony`,
  },
  {
    key: "touch_8",
    label: "Four days out",
    placeholders: ["name"],
    subject: "Four days",
    body: `Hey {{name}} —

Four days until Build to Last.

A few last things:

- The guest list is set. The room is who it needs to be.
- If there's someone specific you're hoping to meet that night, reply here — I'm keeping a short list of introductions to make.
- There'll be a photographer in the room, candid shots only. You'll get the edited photos after, with permission to post.

See you Thursday.

— Anthony`,
  },
  {
    key: "touch_9",
    label: "Tomorrow",
    placeholders: ["name", "venue_address", "doors_time"],
    subject: "Tomorrow",
    body: `Hey {{name}},

Tomorrow night. {{venue_address}}. Doors at {{doors_time}}.

If anything comes up and you can't make it, reply and let me know — your seat goes to someone who can.

See you then.

— Anthony`,
  },
  {
    key: "followup_48h",
    label: "48h follow-up (attendees)",
    placeholders: ["name", "photo_gallery_url"],
    subject: "Build to Last — the photos, and thank you",
    body: `Hey {{name}},

Thursday night was something. Thank you for being in that room.

The edited photos from the night are up — post whatever you like.

[See the photos]({{photo_gallery_url}})

The next Build to Last is already in motion. Same intention, new room. Everyone who attended the first one gets first access before invites go wide — and if there's someone you think belongs in the next room, reply with their name.

See you around New Jersey.

— Anthony
Founder, Central Group Events`,
  },
];

export function btlTemplateDef(key: string): BtlTemplateDef | undefined {
  return BTL_TEMPLATE_DEFS.find((t) => t.key === key);
}
