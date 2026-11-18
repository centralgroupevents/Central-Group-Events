// Build to Last — a small file library for outgoing emails (sponsorship
// packages, one-pagers, decks, spreadsheets, images, zips — any file type).
// Files live in app_settings: an index ("btl.files") plus one row per file
// ("btl.file.<id>", base64), so they survive redeploys with no new table.
// Gmail rejects some executable types and caps a message at about 25 MB, so
// those are refused here with a clear message instead of failing at send time.

import crypto from "crypto";
import { storage } from "./storage";

export interface BtlFile { id: string; name: string; size: number; type: string; at: string }

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
/** Raw bytes per email; base64 adds about a third, and Gmail stops at 25 MB. */
export const MAX_EMAIL_FILE_BYTES = 18 * 1024 * 1024;
const BLOCKED_EXT = /\.(exe|bat|cmd|com|cpl|scr|msi|msp|js|jse|vbs|vbe|wsf|wsh|jar|dll|ps1|lnk|reg|hta|vb|pif|gadget)$/i;

export function checkUploadName(name: string): string | null {
  if (BLOCKED_EXT.test(name)) return "Gmail blocks that file type. Zip it, or send it as a link instead.";
  return null;
}

async function readIndex(): Promise<BtlFile[]> {
  try {
    const j = JSON.parse((await storage.getSetting("btl.files")) || "[]");
    return Array.isArray(j) ? j : [];
  } catch { return []; }
}

export async function listBtlFiles(): Promise<BtlFile[]> {
  return (await readIndex()).sort((a, b) => b.at.localeCompare(a.at));
}

export async function saveBtlFile(name: string, type: string, buf: Buffer): Promise<BtlFile> {
  const id = crypto.randomBytes(6).toString("hex");
  const clean = name.replace(/[\\/\r\n\0]/g, "_").trim().slice(0, 150) || "file";
  const file: BtlFile = { id, name: clean, size: buf.length, type: (type || "application/octet-stream").slice(0, 100), at: new Date().toISOString() };
  await storage.setSetting(`btl.file.${id}`, buf.toString("base64"));
  await storage.setSetting("btl.files", JSON.stringify([...(await readIndex()), file]));
  return file;
}

export async function deleteBtlFile(id: string): Promise<boolean> {
  const idx = await readIndex();
  if (!idx.some((f) => f.id === id)) return false;
  await storage.setSetting(`btl.file.${id}`, "");
  await storage.setSetting("btl.files", JSON.stringify(idx.filter((f) => f.id !== id)));
  return true;
}

/** Checks the ids exist and the total fits in one email. Returns an error message or null. */
export async function checkFileIds(ids: string[]): Promise<string | null> {
  if (ids.length === 0) return null;
  const idx = await readIndex();
  let total = 0;
  for (const id of ids) {
    const f = idx.find((x) => x.id === id);
    if (!f) return "One of the chosen files was deleted. Re-pick your attachments.";
    total += f.size;
  }
  if (total > MAX_EMAIL_FILE_BYTES) return `Those files total ${(total / 1048576).toFixed(1)} MB. Keep attachments under ${MAX_EMAIL_FILE_BYTES / 1048576} MB per email (Gmail's limit is 25 MB after encoding), or send a link.`;
  return null;
}

export interface MailFile { filename: string; content: Buffer; contentType: string }

/** The chosen files as nodemailer attachments. Missing/empty files are skipped. */
export async function loadMailFiles(ids: string[]): Promise<MailFile[]> {
  if (ids.length === 0) return [];
  const idx = await readIndex();
  const out: MailFile[] = [];
  for (const id of ids) {
    const f = idx.find((x) => x.id === id);
    const b64 = f ? await storage.getSetting(`btl.file.${id}`) : null;
    if (f && b64) out.push({ filename: f.name, content: Buffer.from(b64, "base64"), contentType: f.type });
  }
  return out;
}

/** Extras for a scheduled send (BCC + files), kept next to the row's id. */
export interface SendExtras { bcc: string[]; fileIds: string[] }

export async function saveSendExtras(rowId: number, extras: SendExtras): Promise<void> {
  if (extras.bcc.length === 0 && extras.fileIds.length === 0) return;
  await storage.setSetting(`btl.sendExtras.${rowId}`, JSON.stringify(extras));
}

export async function loadSendExtras(rowId: number): Promise<SendExtras> {
  try {
    const j = JSON.parse((await storage.getSetting(`btl.sendExtras.${rowId}`)) || "{}");
    return { bcc: Array.isArray(j.bcc) ? j.bcc.map(String) : [], fileIds: Array.isArray(j.fileIds) ? j.fileIds.map(String) : [] };
  } catch { return { bcc: [], fileIds: [] }; }
}
