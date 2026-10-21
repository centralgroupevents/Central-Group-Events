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
// - everything else → a normal paragraph; single line breaks become <br>
const BULLET_RE = /^(✔|✓|•|\*|-|\d+[.)])\s/;

function inline(line: string): string {
  return esc(line).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#8a6d3b">$1</a>');
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

// The shared shell: quiet, serif, personal. unsubscribeUrl renders as one
// plain line at the bottom — no marketing footer bars.
export function btlShell(bodyHtml: string, unsubscribeUrl: string): string {
  return `
  <div style="background:#faf8f4;padding:28px 16px">
    <div style="max-width:560px;margin:0 auto;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.75;color:#262118">
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
    subject: "You're in — Build to Last Nov 12",
    body: `Hey {{name}},

You're confirmed for Build to Last Vol. 1 on Thursday, November 12th in Newark.

Your question is noted and going into the briefing I'm sending each speaker once they're locked. If your question comes up that night, you'll know I heard you.

I'll be in touch over the next couple weeks with speaker announcements, venue details, and run of show.

— Anthony`,
  },
  {
    key: "initial_invite",
    label: "Initial invites",
    placeholders: ["name", "first_name", "rsvp_url", "venue_name", "doors_time", "program_start_time"],
    subject: "Hey {{name}} — hosting something I want you in the room for.",
    body: `Hey {{name}} —

I'm putting together the first Build to Last on Thursday, November 12th in Newark. It's an intimate convening for the people in this city who are serious about turning what they do into something that lasts: planners, DJs, influencers, venue owners, and the quiet operators building the next decade of Newark's creative economy.

The premise is simple. Newark has the talent. What it doesn't have — reliably — is the business architecture around that talent: the contracts that protect you, the funding you don't know how to access, the venue economics nobody explains, the real read on where this city is actually heading. So I'm bringing in four voices across those four questions, in conversation with each other and the room. Not a panel. Not a lecture.

✦ WHAT TO EXPECT

✔ Four conversation stations — legal protection, funding, venue economics, and where Newark's market is heading. You rotate through all four.
✔ Speakers briefed on YOUR questions before the night — I'll ask for yours right after you sign up
✔ Open bar + small bites throughout
✔ A printed guest book of everyone in the room: who they are and what they're building
✔ Intentional networking — not business-card roulette

✦ YOU'LL WALK AWAY WITH

✔ A straight answer to the question you've been circling
✔ The contacts you actually need — tell me who you want to meet and I'll make the intro on the night
✔ Field Notes after: the room's best questions with the speakers' answers written up

✦ EVENT FLOW

{{doors_time}} — Doors, drinks, guest book
{{program_start_time}} — Conversation stations begin
8:00 PM — Open networking
8:30 PM — Close

✦ THE DETAILS

Thursday, November 12 · {{venue_name}}, Newark
Free · RSVP required
Dress code: come as yourself, elevated.

The room is small on purpose. I'd rather have 30 of the right people than 100 of everyone.

RSVP here: {{rsvp_url}}

One ask when you register: there's a question asking what you most want answered that night. Please take it seriously — your answers are literally shaping what the speakers cover.

Build to Last is a series — this is Vol. 1, and the people in this room get first access to every room after it. Speakers announced in the next couple weeks.

— Anthony`,
  },
  {
    key: "guest_info",
    label: "Thank you + your two questions",
    placeholders: ["name", "first_name", "questions_url", "rsvp_url"],
    subject: "Thank you — and two quick questions",
    body: `Hey {{name}},

Thank you — whether you've locked in your spot for Build to Last on Thursday, November 12th or you're still figuring out if you can make it, I appreciate you even considering the room. It's free, and it's small on purpose.

Either way, I have one ask that takes two minutes. Two questions:

✔ One line on who you are and what you're working on — it goes into the printed guest book handed to every attendee
✔ The one question you most want answered that night — I'm briefing every speaker on the room's actual questions

Answer both here: {{questions_url}}

If it turns out you can't make it this time, your answers still shape the night — and you're first in line for Vol. 2.

— Anthony`,
  },
  {
    key: "touch_4",
    label: "What this room wants to know",
    placeholders: ["name", "question_themes"],
    subject: "What this room wants to know",
    body: `Hey {{name}} —

Quick update on Build to Last as we get closer.

The questions coming in from the RSVPs so far have been honestly incredible. A few themes already emerging:

{{question_themes}}

I'm using these to brief every speaker. Every station is going to be built around what people in the room actually want to know.

Speaker announcements coming soon. See you Nov 12.

— Anthony`,
  },
  {
    key: "touch_5",
    label: "Second wave (non-responders)",
    placeholders: ["name", "confirmed_count", "rsvp_url"],
    subject: "Build to Last Nov 12 — closing invites soon",
    body: `Hey {{name}} —

Following up on the Build to Last invite from a couple weeks ago. The room is coming together — {{confirmed_count}} confirmed so far — and I'm starting to close invites in the next week or so to keep it intentional in size.

If Nov 12 works for you, I'd love to have you in the room. If it doesn't, totally understand — just let me know and I'll make sure you're first on the list for Vol. 2.

RSVP: {{rsvp_url}}

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

- Full guest list is set. The room is who it needs to be.
- If you need to introduce yourself to someone specific that night, reply here. I'm making a short list of intros to make on the fly.
- Content: there'll be a photographer and videographer in the room. Candid shots only. You'll get edited photos and a short recap video within 48 hours with permission to post. No video of conversations without consent.

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
    placeholders: ["name", "photo_gallery_url", "recap_video_url", "field_notes_url", "contact_sheet_line"],
    subject: "Build to Last Vol. 1 — field notes, photos, and what's next",
    body: `Hey {{name}} —

Thursday night was something. Thank you for being in that room.

Here's what you need:

Photos from the night: {{photo_gallery_url}}

Recap video (90 seconds): {{recap_video_url}}

{{contact_sheet_line}}

Field Notes: the top questions this room asked, with the speakers' answers written up — {{field_notes_url}}

Vol. 2 is already in motion. Early 2027. Same format, different lineup, same intention. If there's someone you think should be in the next room — reply with their name.

One more thing: everyone who attended Vol. 1 gets first access to Vol. 2 before invites go wide. Keep an eye out.

See you around Newark.

— Anthony`,
  },
];

export function btlTemplateDef(key: string): BtlTemplateDef | undefined {
  return BTL_TEMPLATE_DEFS.find((t) => t.key === key);
}
