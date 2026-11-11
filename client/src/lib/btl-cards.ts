// Build to Last name cards — business-card shaped (3.5 × 2 in), 10 per US
// Letter sheet in a 2 × 5 grid, which is the most cards per sheet and fits
// standard 10-up perforated card stock. Two formats:
//   one-sided  front: name, title, Instagram + a QR code beside them
//   two-sided  front: name, title, Instagram · back: QR code + a question
// The QR goes to the guest's Instagram, or to @centralgroupevents when we
// don't have one. Rendered as HTML so it previews in the admin and prints
// (or saves as PDF) straight from the browser.

import qrcode from "./vendor/qrcode-generator";

export const CGE_INSTAGRAM = "centralgroupevents";

export type CardFormat = "one" | "two";
export type CardPageOrder = "alternate" | "fronts-first";

export interface CardGuest {
  name: string;
  title: string;
  /** "@handle" or null */
  ig: string | null;
  question: string;
}

const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function cardQrUrl(g: Pick<CardGuest, "ig">): string {
  const h = (g.ig || `@${CGE_INSTAGRAM}`).replace(/^@/, "");
  return `https://instagram.com/${h}`;
}

/** Inline SVG QR (black on white, crisp edges). */
export function qrSvg(url: string): string {
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" class="bc-qr"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#0b0b0e"/></svg>`;
}

function nameSize(name: string): string {
  const len = name.length;
  if (len <= 13) return "17pt";
  if (len <= 18) return "14.5pt";
  if (len <= 26) return "12.5pt";
  return "11pt";
}

/** Rows of fixed-width C / G / E cells, each row shifted one cell, so every
 *  letter lines up on a diagonal (the "stacked CGE" background). */
function pattern(opacity: number): string {
  let h = `<div class="bc-pat" style="opacity:${opacity}">`;
  for (let r = 0; r < 9; r++) {
    let row = "";
    for (let c = 0; c < 16; c++) row += `<span>${"CGE"[(c + r) % 3]}</span>`;
    h += `<div class="bc-prow">${row}</div>`;
  }
  return h + "</div>";
}

function footer(logo: string, right: string): string {
  return `<div class="bc-ft"><img src="${logo}" alt="CGE"><span>${esc(right)}</span></div>`;
}

const BLANK_QUESTION = "What brought you here tonight, and who are you hoping to meet?";

export function cardFront(g: CardGuest | null, format: CardFormat, logo: string): string {
  const name = g ? esc(g.name) : '<span class="bc-blank">Name</span>';
  const title = g ? (g.title ? `<div class="bc-rl">${esc(g.title)}</div>` : "") : '<div class="bc-rl bc-blank">Role</div>';
  const ig = g ? (g.ig ? `<div class="bc-ig">${esc(g.ig)}</div>` : "") : '<div class="bc-ig bc-blank">@instagram</div>';
  const nm = `<div class="bc-nm${format === "two" ? " bc-big" : ""}" style="font-size:${g ? (format === "two" ? "22pt" : nameSize(g.name)) : "17pt"}">${name}</div>`;
  const foot = footer(logo, "Built to Last · Nov 12 · Equal Space");
  if (format === "one") {
    const qrUrl = cardQrUrl(g ?? { ig: null });
    const cap = g?.ig ? `Scan to follow ${g.ig}` : `Scan to follow @${CGE_INSTAGRAM}`;
    return `<div class="bc">${pattern(0.085)}<div class="bc-in1"><div class="bc-l">${nm}${title}${ig}</div><div class="bc-r">${qrSvg(qrUrl)}<div class="bc-cap">${esc(cap)}</div></div></div>${foot}</div>`;
  }
  return `<div class="bc">${pattern(0.085)}<div class="bc-in2">${nm}${title}${ig}</div>${foot}</div>`;
}

export function cardBack(g: CardGuest | null, logo: string): string {
  const qrUrl = cardQrUrl(g ?? { ig: null });
  const cap = g?.ig ? `Scan to follow ${g.ig}` : `Scan to follow @${CGE_INSTAGRAM}`;
  const q = g?.question?.trim() || BLANK_QUESTION;
  return `<div class="bc">${pattern(0.055)}<div class="bc-in3"><div class="bc-qw">${qrSvg(qrUrl)}<div class="bc-cap">${esc(cap)}</div></div><div class="bc-q"><div class="bc-k">Conversation starter</div><p style="font-size:${q.length > 120 ? "8.4pt" : "9.6pt"}">${esc(q)}</p></div></div>${footer(logo, "centralgroupevents.com")}</div>`;
}

export const CARD_CSS = `
.bc{position:relative;width:3.5in;height:2in;overflow:hidden;background:#0b0b0e;color:#f3ecdd;font-family:Inter,"Helvetica Neue",Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bc *{box-sizing:border-box}
.bc-pat{position:absolute;inset:0;overflow:hidden;color:#f0a31a;font:900 .34in/.255in Inter,Arial,sans-serif;white-space:nowrap;pointer-events:none}
.bc-prow{height:.255in;display:flex;margin-left:-.12in}.bc-prow span{display:block;width:.30in;text-align:center;height:.255in}
.bc-in1{position:absolute;left:.2in;right:.18in;top:.2in;bottom:.42in;display:flex;justify-content:space-between;align-items:flex-start}
.bc-l{flex:1;min-width:0;padding-right:.1in;display:flex;flex-direction:column;justify-content:center;height:100%}
.bc-nm{font-weight:800;line-height:1.05;color:#fff;letter-spacing:-.2px;overflow-wrap:anywhere}
.bc-rl{margin-top:.07in;font-weight:700;font-size:6.6pt;letter-spacing:1.6px;text-transform:uppercase;color:#f0a31a;line-height:1.25}
.bc-ig{margin-top:.09in;font-weight:500;font-size:9pt;color:#e9e1cf;overflow-wrap:anywhere}
.bc-blank{color:#6d6757 !important;font-weight:600}
.bc-r{width:.98in;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;flex:none}
.bc-qr{width:.84in;height:.84in;background:#fff;padding:.05in;border-radius:.05in;display:block}
.bc-cap{margin-top:.05in;font-weight:500;font-size:4.8pt;line-height:1.2;color:#d9d0bd;text-align:center;letter-spacing:.2px;max-width:1in;overflow-wrap:anywhere}
.bc-ft{position:absolute;left:.2in;right:.2in;bottom:.14in;display:flex;justify-content:space-between;align-items:center}
.bc-ft img{height:.13in}.bc-ft span{font-weight:600;font-size:5.2pt;letter-spacing:1.4px;text-transform:uppercase;color:#bdb39b}
.bc-in2{position:absolute;left:.25in;right:.25in;top:.2in;bottom:.42in;display:flex;flex-direction:column;justify-content:center}
.bc-in2 .bc-ig{font-size:11pt}.bc-in2 .bc-rl{font-size:7.6pt}
.bc-in3{position:absolute;left:.2in;right:.2in;top:.2in;bottom:.42in;display:flex;gap:.17in;align-items:center}
.bc-qw{width:1.05in;display:flex;flex-direction:column;align-items:center;flex:none}
.bc-qw .bc-qr{width:1in;height:1in}.bc-qw .bc-cap{font-size:5pt}
.bc-k{font-weight:700;font-size:6.6pt;letter-spacing:1.6px;text-transform:uppercase;color:#f0a31a;margin-bottom:.05in}
.bc-q p{margin:0;font-weight:600;line-height:1.35;color:#f3ecdd}
`;

/** Full printable document: Letter pages, 2 × 5 cards, light cut guides. */
export function cardsDocument(opts: {
  guests: CardGuest[];
  format: CardFormat;
  order: CardPageOrder;
  blanks: number;
  origin: string;
}): string {
  const logo = `${opts.origin}/cge-logo.png`;
  const items: Array<CardGuest | null> = [...opts.guests, ...Array.from({ length: Math.max(0, opts.blanks) }, () => null)];
  const pages: Array<{ cards: Array<CardGuest | null>; side: "front" | "back" }> = [];
  for (let i = 0; i < items.length; i += 10) {
    const chunk = items.slice(i, i + 10);
    pages.push({ cards: chunk, side: "front" });
    if (opts.format === "two" && opts.order === "alternate") pages.push({ cards: chunk, side: "back" });
  }
  if (opts.format === "two" && opts.order === "fronts-first") {
    for (let i = 0; i < items.length; i += 10) pages.push({ cards: items.slice(i, i + 10), side: "back" });
  }
  const sheet = (cards: Array<CardGuest | null>, side: "front" | "back") => {
    let h = '<section class="sheet">';
    cards.forEach((c, i) => {
      const row = Math.floor(i / 2), col = i % 2;
      // Backs are mirrored left-right so a flip on the long edge lines up.
      const x = 0.75 + (side === "back" ? 1 - col : col) * 3.5;
      const y = 0.5 + row * 2;
      h += `<div class="slot" style="left:${x}in;top:${y}in">${side === "front" ? cardFront(c, opts.format, logo) : cardBack(c, logo)}</div>`;
    });
    for (let c = 0; c <= 2; c++) h += `<i class="cut v" style="left:${0.75 + c * 3.5}in"></i>`;
    for (let r = 0; r <= 5; r++) h += `<i class="cut h" style="top:${0.5 + r * 2}in"></i>`;
    return h + "</section>";
  };
  return `<!doctype html><html><head><meta charset="utf-8"><title>Build to Last — name cards</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&display=swap" rel="stylesheet">
<style>
@page{size:8.5in 11in;margin:0}
html,body{margin:0;background:#fff}
.sheet{position:relative;width:8.5in;height:11in;overflow:hidden;page-break-after:always;break-after:page;background:#fff}
.slot{position:absolute;width:3.5in;height:2in}
.cut{position:absolute;background:#c8c8c8}.cut.v{top:.4in;width:.5px;height:10.2in}.cut.h{left:.65in;height:.5px;width:7.2in}
${CARD_CSS}
</style></head><body>${pages.map((p) => sheet(p.cards, p.side)).join("")}</body></html>`;
}
