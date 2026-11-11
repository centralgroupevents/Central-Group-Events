// Build to Last Vol. 1 — email templates.
//
// These are deliberately personal notes, not marketing emails: serif body,
// generous line-height, a small CGE wordmark on top, the sponsor and venue
// logos at the bottom, and a plain unsubscribe line.
//
// Every template is plain text with {{placeholders}} — the defaults live
// here, and the admin can override any template's subject/body from the
// Build to Last → Templates view (stored in app_settings as
// "btl.tpl.<key>.subject" / "btl.tpl.<key>.body", resolved in btl-cadence).
// A line that is just "✦ SECTION TITLE" renders as a small gold section
// header; "✔" bullets and plain lines render as-is.

import { CGE_LOGO_CID, partnersFooterHtml } from "./btl-brand";
export { CGE_LOGO_CID };

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
export function btlShell(bodyHtml: string, unsubscribeUrl: string): string {
  return `
  <div style="background:#faf8f4;padding:28px 16px">
    <div style="max-width:560px;margin:0 auto;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.75;color:#262118">
      <img src="cid:${CGE_LOGO_CID}" alt="Central Group Events" width="96" height="22" style="display:block;width:96px;height:auto;margin:0 0 26px;border:0" />
      ${bodyHtml}
      ${partnersFooterHtml()}
      <p style="margin:26px 0 0;color:#9a917f;font-size:12px;font-family:Georgia,serif">
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
    placeholders: ["name", "first_name", "venue_name", "doors_time", "speaker_cards"],
    subject: "You're in — Build to Last, Nov 12",
    body: `Hey {{name}},

You're confirmed for Build to Last on Thursday, November 12th at {{venue_name}} in Newark. Doors open at {{doors_time}}.

✦ MEET THE PANEL

{{speaker_cards}}

We'll share more as the night gets closer — run of show and everything else worth knowing.

Looking forward to having you in the room.

— Anthony
Founder, Central Group Events`,
  },
  {
    key: "initial_invite",
    label: "Initial invites",
    placeholders: ["name", "first_name", "rsvp_url", "venue_name", "doors_time", "program_start_time", "speaker_cards"],
    subject: "You're invited — Build to Last, Nov 12 in Newark",
    body: `Hey {{name}},

In about three weeks, we're hosting the first Build to Last — an invite-only mixer for the planners, venue owners, and creators we've met promoting events across New Jersey.

Promoting events across this state, we've come across so many influential, hardworking people who chose to curate spaces and places here — and who believe New Jersey is only going to present more opportunities for people like us. The best habit any of us can keep is an informed, active network that learns from one another. Build to Last is that habit, in person.

✦ WHAT TO EXPECT

✔ An intentionally set crowd — planners, venue owners, and creators from across the state
✔ Moderated conversations on event planning, spaces, and brand building in NJ
✔ A professionally photographed night — you'll get the photos after

✦ MEET THE PANEL

{{speaker_cards}}

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
    placeholders: ["name", "speaker_cards", "speaker_lineup", "venue_name", "venue_address", "doors_time", "program_start_time"],
    subject: "Your Nov 12 speakers",
    body: `Hey {{name}} —

Meet the panel for Build to Last Vol. 1 — real estate, automation, and policy:

{{speaker_cards}}

Format: a moderated panel conversation with time for your questions, with mixing before and after. Intimate, direct, every voice heard.

Logistics:

- {{venue_address}}
- Doors at {{doors_time}}
- Programming starts promptly at {{program_start_time}}
- Open bar and small bites throughout
- Light dress code: come as yourself, elevated

See you Thursday.

— Anthony`,
  },
  {
    key: "touch_8",
    label: "Four days out",
    placeholders: ["name", "speaker_cards"],
    subject: "Four days",
    body: `Hey {{name}} —

Four days until Build to Last.

A few last things:

- The guest list is set. The room is who it needs to be.
- If there's someone specific you're hoping to meet that night, reply here — I'm keeping a short list of introductions to make.
- There'll be a photographer in the room, candid shots only. You'll get the edited photos after, with permission to post.

✦ ON THE PANEL

{{speaker_cards}}

See you Thursday.

— Anthony`,
  },
  {
    key: "touch_9",
    label: "Tomorrow",
    placeholders: ["name", "venue_address", "doors_time", "speaker_cards"],
    subject: "Tomorrow",
    body: `Hey {{name}},

Tomorrow night. {{venue_address}}. Doors at {{doors_time}}.

✦ ON THE PANEL

{{speaker_cards}}

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
  // ── Speaker emails — sent one-at-a-time from Templates → "Send to…",
  //    never by the cadence (they have no BTL_CADENCE entry). ───────────
  {
    key: "speaker_invite",
    label: "Speaker — the ask",
    placeholders: ["name", "first_name", "venue_name", "doors_time", "program_start_time"],
    subject: "Invitation to Speak — Build to Last, November 12, Newark",
    body: `Dear {{first_name}},

My name is Anthony, founder of Central Group Events. We promote events across New Jersey, and on Thursday, November 12th we are hosting Build to Last — an invite-only evening at {{venue_name}} in Newark bringing together the planners, venue owners, and creators building across the state.

The centerpiece of the evening is a series of moderated conversations on event planning, spaces, and brand building in New Jersey, and I would be honored to have you join us as a featured speaker. Your perspective is precisely what this room is gathering for.

✦ THE DETAILS

✔ Thursday, November 12 · {{venue_name}}, Newark
✔ Doors at {{doors_time}} with an open bar · conversations begin at {{program_start_time}} · the evening closes at 8:30 PM
✔ Your role: a moderated conversation — no slides or prepared remarks required, simply your perspective in an engaged room
✔ The night is professionally photographed; you will receive the full set of edited photos, free to share

Attendance is complimentary and the room is set by invitation. It would be a privilege to include you on the program — may I confirm your participation?

I'm happy to answer any questions by reply, or to arrange a brief call at your convenience.

With appreciation,

Anthony
Founder, Central Group Events`,
  },
  {
    key: "speaker_confirm",
    label: "Speaker — confirmed + what I need",
    placeholders: ["name", "first_name", "venue_name", "doors_time", "program_start_time"],
    subject: "You're on — Build to Last, Nov 12",
    body: `Hey {{first_name}},

Locked in — you're speaking at Build to Last on Thursday, November 12th at {{venue_name}} in Newark. Thank you.

So we can announce you properly, reply with three things:

1. A headshot you like
2. Two or three lines on who you are and what you build
3. The Instagram handle you want tagged

✦ WHAT TO EXPECT

✔ Doors at {{doors_time}} — come early and meet the room over the open bar
✔ Moderated conversations start at {{program_start_time}}; I'll send your segment time and the conversation directions beforehand — no slides, nothing to memorize
✔ A photographer covers the night — you get the edited photos after

Full logistics land the week of. Anything you need from me in the meantime, just reply.

— Anthony
Founder, Central Group Events`,
  },
  {
    key: "speaker_logistics",
    label: "Speaker — week-of logistics",
    placeholders: ["name", "first_name", "venue_address", "doors_time", "program_start_time"],
    subject: "Thursday's run-through — Build to Last",
    body: `Hey {{first_name}},

Build to Last is this Thursday. Everything you need:

✦ LOGISTICS

✔ {{venue_address}}
✔ Arrive by {{doors_time}} and check in with me at the door
✔ Conversations start at {{program_start_time}} — I'll walk you through the order when you arrive
✔ Dress code: come as yourself — business casual is perfect
✔ Open bar and small bites all night

Format reminder: it's a moderated conversation, not a presentation. I'll guide it — you just bring your perspective.

If anything comes up before Thursday, reply here.

See you Thursday.

— Anthony`,
  },
  {
    key: "speaker_thanks",
    label: "Speaker — thank you (after)",
    placeholders: ["name", "first_name", "photo_gallery_url"],
    subject: "Thank you — you made the room",
    body: `Hey {{first_name}},

Thursday wouldn't have been the same without you — thank you for giving the room your time and your perspective. People were still quoting you at the night cap.

The edited photos from the night are up — post whatever you like.

[See the photos]({{photo_gallery_url}})

Build to Last Vol. 2 is already in motion, and you'll be one of the first calls. And if there's anything I can do for you — an introduction from that room, a promo push for something you're building — reply and it's done.

— Anthony
Founder, Central Group Events`,
  },
  // ── Panel / venue emails — manual sends ("Send to…" → pick people),
  //    never by the cadence. {{speaker_cards}} adds each panelist's photo. ──
  {
    key: "venue_info",
    label: "Venue — panelists, sponsor & about CGE",
    placeholders: ["name", "first_name", "venue_name", "speaker_cards"],
    subject: "Built to Last (Nov 12): panelists, sponsor, and about CGE",
    body: `Hi {{name}},

Ahead of Built to Last on Thursday, November 12 at {{venue_name}}, here is the information on our panelists and our sponsor, along with a short description of Central Group Events.

✦ ABOUT CENTRAL GROUP EVENTS

Central Group Events (CGE) is a New Jersey-based digital media and event promotion platform connecting the region’s most established curators and event professionals. Over three years of promoting events across the state, we’ve built deep insight into the unique needs of NJ’s townships, businesses, and event-goers; we’ve grown to 6,100+ social media followers. Now, we’re taking a more intentional approach: producing curated, invite-only experiences designed to bring the right people together, build a connected ecosystem, and move the NJ event industry forward. Our upcoming event, Built to Last, brings together industry leaders for a panel discussion and networking evening at Equal Space in Newark on November 12, 2026.

✦ ABOUT THE EVENING

Built to Last is an invite-only evening with the area's most established event professionals: a panel discussion and networking experience built for the people already doing the work. It is hosted by Central Group Events and takes place at {{venue_name}} in Newark. The panel covers real estate, automation, and policy.

✦ THE PANELISTS

{{speaker_cards}}

Moderator: Abrahim Kenneh, Co-Founder, Central Group Events

✦ OUR SPONSOR: AISLEGO

AisleGo is our Executive Sponsor for the evening. Its Founder & CEO, TC Cuthbertson, is one of our panelists. AisleGo is credited as Executive Sponsor on the Built to Last RSVP page and on the closing slide of the panel presentation. You can find them at [aislego.co](https://aislego.co).

If AisleGo's logo or a small sign can be displayed near the bar or check-in, please let us know what works for the space. I will also send our guest list and the final run of show separately.

Thank you again for hosting us.

— Anthony
Founder, Central Group Events`,
  },
  {
    key: "panelist_brief",
    label: "Panelists — the panel, the details & about CGE",
    placeholders: ["name", "first_name", "venue_name", "venue_address", "doors_time", "program_start_time", "speaker_cards"],
    subject: "Built to Last (Nov 12): your panel and the details",
    body: `Hi {{first_name}},

Thank you again for joining us. Here is the full panel for Built to Last on Thursday, November 12 at {{venue_name}}, so you know who you'll be sharing the room with.

✦ THE PANEL — REAL ESTATE, AUTOMATION, AND POLICY

{{speaker_cards}}

Moderator: Abrahim Kenneh, Co-Founder, Central Group Events

✦ THE DETAILS

- {{venue_address}}
- Doors at {{doors_time}}
- Programming starts at {{program_start_time}}
- Executive Sponsor: AisleGo

✦ ABOUT CENTRAL GROUP EVENTS

Central Group Events (CGE) is a New Jersey-based digital media and event promotion platform connecting the region’s most established curators and event professionals. Over three years of promoting events across the state, we’ve built deep insight into the unique needs of NJ’s townships, businesses, and event-goers; we’ve grown to 6,100+ social media followers. Now, we’re taking a more intentional approach: producing curated, invite-only experiences designed to bring the right people together, build a connected ecosystem, and move the NJ event industry forward. Our upcoming event, Built to Last, brings together industry leaders for a panel discussion and networking evening at Equal Space in Newark on November 12, 2026.

If anything changes on your end, just reply to this email.

— Anthony
Founder, Central Group Events`,
  },
  {
    key: "guest_panel_info",
    label: "Guests — panel info + updated times",
    placeholders: ["name", "first_name", "venue_name", "doors_time", "program_start_time", "speaker_cards"],
    subject: "Built to Last (Nov 12): the panel and updated times",
    body: `Hey {{name}},

A quick update on Built to Last on Thursday, November 12 at {{venue_name}}: who's on the panel, and the updated times.

✦ UPDATED TIMES

- Doors at {{doors_time}}
- Panel and conversation at {{program_start_time}}

✦ ON THE PANEL — REAL ESTATE, AUTOMATION, AND POLICY

{{speaker_cards}}

Moderator: Abrahim Kenneh, Co-Founder, Central Group Events. Our Executive Sponsor is AisleGo.

If there's a question you'd like the panel to take on, hit reply and tell me.

See you Thursday.

— Anthony
Founder, Central Group Events`,
  },
  {
    key: "sponsor_aislego",
    label: "Meet our Executive Sponsor — AisleGo",
    placeholders: ["name", "first_name", "aislego_card", "founder_card"],
    subject: "Our biggest thank-you: meet AisleGo, our Executive Sponsor",
    body: `Hey {{name}},

✦ OUR BIGGEST THANK-YOU

Built to Last is happening because of one partner above all: our Executive Sponsor, AisleGo. Their support is what makes Thursday possible, and the whole Central Group Events team couldn't be more grateful.

{{aislego_card}}

✦ WHO THEY ARE

AisleGo is a booking platform for group experiences and events. Hosts can search for vendors, see pricing and availability, message them, and book and pay, all in one app. Vendors get their own storefront to list services and prices, manage leads, schedule tours and calls, and get paid through the platform.

✦ HOW LONG THEY'VE BEEN AT IT

AisleGo has been going since 2017. It grew out of EventRoostr, the events company founder TC Cuthbertson built through hands-on work in the business, including managing venues right here in New Jersey.

✦ THE FOUNDER

{{founder_card}}

TC's path is a lesson in adapting. He started with TripRoostr, a trip-planning platform. When the market shifted, with the launch of Airbnb Experiences, he scrapped it and rebuilt around events. He then ran venues in New Jersey and Pennsylvania, and turned what he learned on the ground into software that helps small event businesses get found, priced and paid online.

In an economy where the way people discover, book and pay keeps changing, that willingness to adapt is exactly what Built to Last is about.

✦ MEET HIM THURSDAY

Please stop by and meet TC in person. Ask him about the perks AisleGo offers hosts and vendors, and where the platform is headed next, including the gaps in the ticketing industry they plan to address.

[Visit AisleGo](https://aislego.co)

Thank you again, TC and the whole AisleGo team, for believing in this room and making Thursday happen.

— The Central Group Events team`,
  },
  {
    key: "sponsor_equal_space",
    label: "Welcome + thanks — Equal Space",
    placeholders: ["name", "first_name", "equal_space_card"],
    subject: "Welcome to Equal Space, and thank you",
    body: `Hey {{name}},

✦ WELCOME, AND THANK YOU

Thursday night we're guests at Equal Space in Newark. A warm welcome to everyone coming, and a big thank-you from the Central Group Events team to the Equal Space team for opening their doors to Built to Last.

{{equal_space_card}}

✦ WHO THEY ARE

Equal Space is a Newark coworking and community campus built for entrepreneurs, creatives and builders, with a mission of helping local entrepreneurs and small businesses, largely led by women, people of color and members of the LGBTQ+ community, succeed. Members get meeting rooms, a podcast studio, event space and access to mentors, investors and partners.

✦ HOW LONG THEY'VE BEEN AT IT

Equal Space was co-founded in 2014 by Citi Medina and Ralphie Roman. Medina moved to Newark from Brooklyn, saw that no co-working space served people of color, and built one. It began with ES89 at 89 Market Street, a social justice and creative campus. In May 2024 it opened ES550, a 50,000-square-foot tech and innovation campus at 550 Broad Street, supported by a $2 million grant from the New Jersey Economic Development Authority.

✦ WHY IT MATTERS

As work gets more independent and flexible, Equal Space gives Newark's small businesses and creatives a place to work, to meet, and to grow, and it shows what building the local economy from the inside looks like. That is the spirit of this evening.

✦ COME SAY HELLO

Arrive a little early, look around, and say thank you to the team. We're proud to be in their room.

— The Central Group Events team`,
  },
];

export function btlTemplateDef(key: string): BtlTemplateDef | undefined {
  return BTL_TEMPLATE_DEFS.find((t) => t.key === key);
}
