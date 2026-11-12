// Build to Last name cards — business-card shaped (3.5 × 2 in), 10 per US
// Letter sheet in a 2 × 5 grid, which is the most cards per sheet and fits
// standard 10-up perforated card stock. Two formats:
//   one-sided  front: name, title, Instagram on the left and the QR code on
//              the right, with one question underneath both
//   two-sided  front: name, title, Instagram · back: QR code with two
//              questions next to it
// The QR goes to the guest's Instagram, or to @centralgroupevents when we
// don't have one. Rendered as HTML so it previews in the admin and prints
// (or saves as PDF) straight from the browser.

import qrcode from "./vendor/qrcode-generator";

export const CGE_INSTAGRAM = "centralgroupevents";

export type CardFormat = "one" | "two";
export type CardPageOrder = "alternate" | "fronts-first";
/** "ten": 10 per sheet, no bleed (perforated card stock). "shop": 8 per sheet
 *  with 1/8 in bleed and crop marks, for a print shop to cut with a guillotine. */
export type CardSheetLayout = "ten" | "shop";

export interface CardGuest {
  name: string;
  title: string;
  /** "@handle" or null */
  ig: string | null;
  /** First question (the only one on a one-sided card) */
  ask: string;
  /** Second question (two-sided backs only) */
  share: string;
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" class="bc-qr"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

function nameSize(name: string): string {
  const len = name.length;
  if (len <= 13) return "17pt";
  if (len <= 18) return "14.5pt";
  if (len <= 26) return "12.5pt";
  return "11pt";
}

/** Rows of fixed-width C / G / E cells, each row shifted one cell, so every
 *  letter lines up on a diagonal (the "stacked CGE" background). The whole
 *  grid is tilted 15 degrees (Syne ExtraBold) and oversized so it still
 *  covers the card corners. */
function pattern(opacity: number): string {
  let h = `<div class="bc-pat" style="opacity:${opacity}"><div class="bc-patin">`;
  for (let r = 0; r < 14; r++) {
    let row = "";
    for (let c = 0; c < 17; c++) row += `<span>${"CGE"[(c + r) % 3]}</span>`;
    h += `<div class="bc-prow">${row}</div>`;
  }
  return h + "</div></div>";
}

function footer(logo: string, right: string): string {
  return `<div class="bc-ft"><img src="${logo}" alt="CGE"><span>${esc(right)}</span></div>`;
}

const BLANK_ASK = "What brought you here tonight, and who are you hoping to meet?";
const BLANK_SHARE = "What's one thing you've learned this year that you'd pass on?";

/** With bleed, the black field and background letters extend 1/8 in past the
 *  trim on every side; the text and QR stay at their trim-relative positions. */
function wrap(inner: string, extra: string, pat: string, bleed: boolean): string {
  if (!bleed) return `<div class="bc${extra}">${pat}${inner}</div>`;
  return `<div class="bcb">${pat}<div class="bc bc-nobg${extra}">${inner}</div></div>`;
}

export function cardFront(g: CardGuest | null, format: CardFormat, logo: string, bleed = false): string {
  const name = g ? esc(g.name) : '<span class="bc-blank">Name</span>';
  const title = g ? (g.title ? `<div class="bc-rl">${esc(g.title)}</div>` : "") : '<div class="bc-rl bc-blank">Role</div>';
  const ig = g ? (g.ig ? `<div class="bc-ig">${esc(g.ig)}</div>` : "") : '<div class="bc-ig bc-blank">@instagram</div>';
  const nm = `<div class="bc-nm${format === "two" ? " bc-big" : ""}" style="font-size:${g ? (format === "two" ? "22pt" : nameSize(g.name)) : "17pt"}">${name}</div>`;
  const foot = footer(logo, "Built to Last · Nov 12 · Equal Space");
  if (format === "one") {
    const qrUrl = cardQrUrl(g ?? { ig: null });
    const cap = g?.ig ? `Scan to follow ${g.ig}` : `Scan to follow @${CGE_INSTAGRAM}`;
    const q = (g ? g.ask.trim() : "") || (g ? "" : BLANK_ASK);
    const qSize = q.length > 120 ? "7.2pt" : q.length > 85 ? "7.8pt" : "8.6pt";
    const question = q ? `<div class="bc-q1"><p style="font-size:${qSize}">${esc(q)}</p></div>` : "";
    return wrap(`<div class="bc-top"><div class="bc-l">${nm}${title}${ig}</div><div class="bc-r">${qrSvg(qrUrl)}<div class="bc-cap">${esc(cap)}</div></div></div>${question}${foot}`, " bc-one", pattern(0.11), bleed);
  }
  return wrap(`<div class="bc-in2">${nm}${title}${ig}</div>${foot}`, "", pattern(0.11), bleed);
}

export function cardBack(g: CardGuest | null, logo: string, bleed = false): string {
  const qrUrl = cardQrUrl(g ?? { ig: null });
  const cap = g?.ig ? `Scan to follow ${g.ig}` : `Scan to follow @${CGE_INSTAGRAM}`;
  let q1 = g?.ask?.trim() ?? "";
  let q2 = g?.share?.trim() ?? "";
  if (!q1 && !q2) { q1 = BLANK_ASK; q2 = BLANK_SHARE; }
  const total = q1.length + q2.length;
  const size = q1 && q2 ? (total > 210 ? "6.9pt" : total > 160 ? "7.4pt" : "8pt") : (total > 120 ? "8.6pt" : "9.6pt");
  const one = (t: string) => (t ? `<p style="font-size:${size}">${esc(t)}</p>` : "");
  return wrap(`<div class="bc-in3"><div class="bc-qw">${qrSvg(qrUrl)}<div class="bc-cap">${esc(cap)}</div></div><div class="bc-q">${one(q1)}${q1 && q2 ? '<i class="bc-div"></i>' : ""}${one(q2)}</div></div>${footer(logo, "centralgroupevents.com")}`, "", pattern(0.08), bleed);
}

/** Syne ExtraBold (800) for the stacked-letter background. */
export const CARD_FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&display=swap');";

export const CARD_CSS = `
.bc{position:relative;width:3.5in;height:2in;overflow:hidden;background:#0b0b0e;color:#f3ecdd;font-family:Inter,"Helvetica Neue",Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bc *{box-sizing:border-box}
.bcb{position:absolute;left:-.125in;top:-.125in;width:3.75in;height:2.25in;overflow:hidden;background:#0b0b0e}
.bc-nobg{position:absolute;left:.125in;top:.125in;background:transparent;overflow:visible}
.bc-pat{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.bc-patin{position:absolute;left:50%;top:50%;width:6.12in;height:3.92in;margin:-1.96in 0 0 -3.06in;transform:rotate(-15deg);transform-origin:center;color:#f0a31a;font-family:Syne,"Archivo","Helvetica Neue",Arial,sans-serif;font-weight:800;font-size:.27in;line-height:.28in;white-space:nowrap}
.bc-prow{height:.28in;display:flex}.bc-prow span{display:block;width:.36in;text-align:center;height:.28in}
.bc-top{position:absolute;left:.2in;right:.18in;top:.14in;height:.98in;display:flex;justify-content:space-between;align-items:flex-start}
.bc-one .bc-r{width:.86in;height:auto}.bc-one .bc-qr{width:.74in;height:.74in;padding:.04in}.bc-one .bc-cap{font-size:4.4pt;max-width:.9in;margin-top:.03in}
.bc-q1{position:absolute;left:.2in;right:.2in;top:1.16in;height:.5in;display:flex;align-items:center}.bc-q1 p{margin:0;font-weight:600;line-height:1.28;color:#f3ecdd;border-left:2px solid #f0a31a;padding-left:.09in}
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
.bc-in3{position:absolute;left:.2in;right:.2in;top:.18in;bottom:.4in;display:flex;gap:.14in;align-items:center}
.bc-qw{width:.92in;display:flex;flex-direction:column;align-items:center;flex:none}
.bc-qw .bc-qr{width:.88in;height:.88in}.bc-qw .bc-cap{font-size:4.8pt}
.bc-div{display:block;width:.4in;height:1.2px;background:#f0a31a;margin:.075in 0}
.bc-q{min-width:0;flex:1}.bc-q p{margin:0;font-weight:600;line-height:1.28;color:#f3ecdd}
`;

/** Full printable document. "ten": Letter pages, 2 × 5 cards, light cut guides.
 *  "shop": Letter pages, 2 × 4 cards (3.5 × 2 in trim, 0.5 in side gap, 1/3 in
 *  row gap, 0.5 in side and 1 in top/bottom margins), 1/8 in bleed, crop marks
 *  in the margins only, and backs mirrored for a flip on the long edge. */
export function cardsDocument(opts: {
  guests: CardGuest[];
  format: CardFormat;
  order: CardPageOrder;
  blanks: number;
  origin: string;
  layout?: CardSheetLayout;
}): string {
  const layout: CardSheetLayout = opts.layout ?? "ten";
  const per = layout === "shop" ? 8 : 10;
  const logo = `${opts.origin}/cge-logo.png`;
  const items: Array<CardGuest | null> = [...opts.guests, ...Array.from({ length: Math.max(0, opts.blanks) }, () => null)];
  const pages: Array<{ cards: Array<CardGuest | null>; side: "front" | "back"; n: number }> = [];
  for (let i = 0; i < items.length; i += per) {
    const chunk = items.slice(i, i + per);
    pages.push({ cards: chunk, side: "front", n: i / per + 1 });
    if (opts.format === "two" && opts.order === "alternate") pages.push({ cards: chunk, side: "back", n: i / per + 1 });
  }
  if (opts.format === "two" && opts.order === "fronts-first") {
    for (let i = 0; i < items.length; i += per) pages.push({ cards: items.slice(i, i + per), side: "back", n: i / per + 1 });
  }
  const bleed = layout === "shop";
  const gapV = 1 / 3;
  const sheet = (cards: Array<CardGuest | null>, side: "front" | "back", sheetNo: number) => {
    let h = '<section class="sheet">';
    cards.forEach((c, i) => {
      let x: number, y: number;
      if (layout === "shop") {
        // Cards 1-4 down the left column, 5-8 down the right. Backs swap the
        // columns (same rows), so a flip on the long edge puts each back behind its front.
        const col = i < 4 ? 0 : 1, row = i % 4;
        x = 0.5 + (side === "back" ? 1 - col : col) * 4;
        y = 1 + row * (2 + gapV);
      } else {
        const row = Math.floor(i / 2), col = i % 2;
        x = 0.75 + (side === "back" ? 1 - col : col) * 3.5;
        y = 0.5 + row * 2;
      }
      h += `<div class="slot" style="left:${x.toFixed(4)}in;top:${y.toFixed(4)}in">${side === "front" ? cardFront(c, opts.format, logo, bleed) : cardBack(c, logo, bleed)}</div>`;
    });
    if (layout === "shop") {
      // Crop marks sit in the outer margins only, outside the bleed, and line
      // up with every trim line. Nothing is drawn on the card edges themselves.
      const xs = [0.5, 4, 4.5, 8];
      const ys = [0, 1, 2, 3].flatMap((r) => [1 + r * (2 + gapV), 1 + r * (2 + gapV) + 2]);
      for (const x of xs) {
        h += `<i class="cm v" style="left:${x}in;top:.57in"></i><i class="cm v" style="left:${x}in;top:10.18in"></i>`;
      }
      for (const y of ys) {
        h += `<i class="cm h" style="top:${y.toFixed(4)}in;left:.07in"></i><i class="cm h" style="top:${y.toFixed(4)}in;left:8.18in"></i>`;
      }
      h += `<div class="sheet-note">Build to Last name cards · sheet ${sheetNo} · ${side === "front" ? "FRONT" : "BACK"} · print at 100%, flip on long edge</div>`;
    } else {
      for (let c = 0; c <= 2; c++) h += `<i class="cut v" style="left:${0.75 + c * 3.5}in"></i>`;
      for (let r = 0; r <= 5; r++) h += `<i class="cut h" style="top:${0.5 + r * 2}in"></i>`;
    }
    return h + "</section>";
  };
  return `<!doctype html><html><head><meta charset="utf-8"><title>Build to Last — name cards</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&display=swap" rel="stylesheet">
<style>
${CARD_FONT_IMPORT}
@page{size:8.5in 11in;margin:0}
html,body{margin:0;background:#fff}
.sheet{position:relative;width:8.5in;height:11in;overflow:hidden;page-break-after:always;break-after:page;background:#fff}
.slot{position:absolute;width:3.5in;height:2in}
.cut{position:absolute;background:#c8c8c8}.cut.v{top:.4in;width:.5px;height:10.2in}.cut.h{left:.65in;height:.5px;width:7.2in}
.cm{position:absolute;background:#000;display:block}.cm.v{width:.5pt;height:.25in}.cm.h{height:.5pt;width:.25in}
.sheet-note{position:absolute;left:0;right:0;top:.22in;text-align:center;font:6pt Arial,Helvetica,sans-serif;letter-spacing:.6px;color:#777;text-transform:uppercase}
${CARD_CSS}
</style></head><body>${pages.map((p) => sheet(p.cards, p.side, p.n)).join("")}</body></html>`;
}
