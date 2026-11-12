// A small, dependency-free PDF writer for the guest list. Plain text in a
// table (Helvetica, US Letter), paginated, so it can be downloaded or
// attached to the email to the venue without a PDF library or a headless
// browser on the server. Characters outside Windows-1252 print as "?".

export interface GuestListRow {
  name: string;
  position: string;
  instagram: string;
}

const WIN1252: Record<string, number> = {
  "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "–": 0x96, "—": 0x97, "•": 0x95, "…": 0x85, "€": 0x80, "·": 0xb7,
};

function encode(s: string): number[] {
  const out: number[] = [];
  for (const ch of s.normalize("NFC")) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0x5c || cp === 0x28 || cp === 0x29) out.push(0x5c, cp); // escape \ ( )
    else if (cp >= 0x20 && cp <= 0x7e) out.push(cp);
    else if (cp >= 0xa0 && cp <= 0xff) out.push(cp);
    else if (WIN1252[ch] !== undefined) out.push(WIN1252[ch]);
    else out.push(0x3f);
  }
  return out;
}

/** Cut a string to roughly `width` points at `size` (Helvetica averages ~0.5 em). */
function fit(s: string, width: number, size: number, bold = false): string {
  const per = size * (bold ? 0.56 : 0.5);
  const max = Math.max(3, Math.floor(width / per));
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

export function guestListPdf(opts: {
  title: string;
  subtitle: string;
  rows: GuestListRow[];
  showInstagram: boolean;
  footer: string;
}): Buffer {
  const W = 612, H = 792, M = 54;
  const ROW = 19;
  const BOTTOM = 76;
  const firstTop = 662; // y of the first row on page 1
  const nextTop = 716;
  const perPage = (top: number) => Math.floor((top - BOTTOM) / ROW) + 1;
  // Split rows across pages.
  const pages: GuestListRow[][] = [];
  let i = 0;
  while (i < opts.rows.length || pages.length === 0) {
    const cap = perPage(pages.length === 0 ? firstTop : nextTop);
    pages.push(opts.rows.slice(i, i + cap));
    i += cap;
    if (opts.rows.length === 0) break;
  }

  const posX = 250, igX = 430;
  const nameW = posX - M - 12;
  const posW = (opts.showInstagram ? igX : W - M) - posX - 12;
  const igW = W - M - igX;

  const streams: Buffer[] = pages.map((rows, pi) => {
    const ops: string[] = [];
    const bytes: Array<number[] | string> = [];
    const text = (font: "F1" | "F2", size: number, x: number, y: number, str: string, gray = 0) => {
      ops.push(`${gray} g BT /${font} ${size} Tf ${x} ${y} Td (`);
      bytes.push(ops.join("\n"));
      ops.length = 0;
      bytes.push(encode(str));
      ops.push(") Tj ET");
    };
    // Header
    if (pi === 0) {
      text("F2", 22, M, 735, opts.title);
      text("F1", 10, M, 716, opts.subtitle, 0.4);
      ops.push(`0.94 0.64 0.10 rg ${M} 704 ${W - 2 * M} 2 re f`);
      text("F2", 8, M, 680, "NAME", 0.45);
      text("F2", 8, posX, 680, "POSITION", 0.45);
      if (opts.showInstagram) text("F2", 8, igX, 680, "INSTAGRAM", 0.45);
      ops.push(`0.8 G 0.5 w ${M} 672 m ${W - M} 672 l S`);
    } else {
      text("F2", 10, M, 744, `${opts.title} (continued)`, 0.4);
      ops.push(`0.8 G 0.5 w ${M} 734 m ${W - M} 734 l S`);
    }
    const top = pi === 0 ? firstTop - 8 : nextTop;
    rows.forEach((r, ri) => {
      const y = top - ri * ROW;
      if (ri % 2 === 0) ops.push(`0.965 0.955 0.93 rg ${M - 4} ${y - 5} ${W - 2 * M + 8} ${ROW - 1} re f`);
      text("F2", 10.5, M, y, fit(r.name, nameW, 10.5, true));
      text("F1", 10, posX, y, fit(r.position, posW, 10), 0.25);
      if (opts.showInstagram) text("F1", 10, igX, y, fit(r.instagram, igW, 10), 0.25);
    });
    // Footer
    text("F1", 8, M, 40, opts.footer, 0.5);
    const label = `Page ${pi + 1} of ${pages.length}`;
    text("F1", 8, W - M - label.length * 4.2, 40, label, 0.5);
    bytes.push(ops.join("\n"));
    const parts = bytes.map((b) => (typeof b === "string" ? Buffer.from(b, "latin1") : Buffer.from(b)));
    return Buffer.concat(parts);
  });

  // Assemble objects: 1 catalog, 2 pages, 3/4 fonts, then (page, stream) pairs.
  const objs: Buffer[] = [];
  const add = (b: Buffer | string) => { objs.push(Buffer.isBuffer(b) ? b : Buffer.from(b, "latin1")); return objs.length; };
  add("<< /Type /Catalog /Pages 2 0 R >>");
  const kids = pages.map((_, k) => `${5 + k * 2} 0 R`).join(" ");
  add(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  pages.forEach((_, k) => {
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + k * 2} 0 R >>`);
    add(Buffer.concat([Buffer.from(`<< /Length ${streams[k].length} >>\nstream\n`, "latin1"), streams[k], Buffer.from("\nendstream", "latin1")]));
  });

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%âãÏÓ\n", "latin1")];
  const offsets: number[] = [];
  let pos = chunks[0].length;
  objs.forEach((o, idx) => {
    offsets.push(pos);
    const head = Buffer.from(`${idx + 1} 0 obj\n`, "latin1");
    const tail = Buffer.from("\nendobj\n", "latin1");
    chunks.push(head, o, tail);
    pos += head.length + o.length + tail.length;
  });
  const xref = [`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`, ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)].join("");
  chunks.push(Buffer.from(`${xref}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`, "latin1"));
  return Buffer.concat(chunks);
}
