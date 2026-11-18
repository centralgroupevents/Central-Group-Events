// Build to Last — sends the admin can fire now or queue for later. The
// route handlers (send now) and the cron runner (send later) both call the
// same two helpers, so a scheduled send behaves exactly like a manual one.

import { storage } from "./storage";
import { BTL_SLUG } from "./btl-emails";
import { getBtlTemplateTexts, renderBtlFromTexts, buildBtlRenderCtx } from "./btl-cadence";
import { deliverBtlEmail, btlSendPause } from "./btl-mailer";
import { loadMailFiles, loadSendExtras, type SendExtras } from "./btl-files";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Parse a comma/semicolon/space separated CC string. Throws on a bad address. */
export function parseCcList(raw: string | null | undefined, label = "CC"): string[] {
  const list = Array.from(new Set(String(raw || "").split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)));
  const bad = list.find((c) => !EMAIL_RE.test(c));
  if (bad) throw new Error(`"${bad}" isn't a valid ${label} email`);
  if (list.length > 5) throw new Error(`${label} up to 5 people`);
  return list;
}

/** Parse the optional file ids sent with a send (de-duplicated, max 10). */
export function parseFileIds(raw: unknown): string[] {
  return Array.from(new Set((Array.isArray(raw) ? raw : []).map((x) => String(x)).filter((x) => /^[a-f0-9]{12}$/.test(x)))).slice(0, 10);
}

/** One template → one person (+ optional CC). Real subject, no dedup. */
export async function sendTemplateToPerson(
  key: string,
  name: string,
  email: string,
  cc: string[],
  extras?: SendExtras,
  /** Already-loaded attachments, so a mass send reads each file once. */
  preloaded?: Array<{ filename: string; content: Buffer; contentType: string }>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const texts = await getBtlTemplateTexts(key);
  if (!texts) return { ok: false, error: `Unknown template "${key}"` };
  const ctx = await buildBtlRenderCtx();
  const tpl = renderBtlFromTexts(texts, { name, email }, ctx);
  const errorOut: { message?: string } = {};
  const files = preloaded ?? (extras ? await loadMailFiles(extras.fileIds) : []);
  const outcome = await deliverBtlEmail({ email }, key, tpl, { force: true, cc, bcc: extras?.bcc ?? [], files, errorOut });
  return outcome === "sent" ? { ok: true } : { ok: false, error: errorOut.message || "Send failed" };
}

/**
 * The initial invite. onlyIds narrows to specific invitees; null = everyone
 * who hasn't received it. Selected rows that already got it count as
 * skipped — per-row Resend is the deliberate way to send twice.
 */
export async function sendInitialInvites(
  onlyIds: Set<number> | null,
): Promise<{ sent: number; skipped: number; failed: number; total: number }> {
  const texts = await getBtlTemplateTexts("initial_invite");
  if (!texts) throw new Error("initial_invite template missing");
  const ctx = await buildBtlRenderCtx();
  const invitees = await storage.listBtlInvitees(BTL_SLUG);
  const targets = invitees.filter((i) =>
    !i.initialInviteSentAt && !i.unsubscribed && i.rsvpStatus !== "declined" &&
    (!onlyIds || onlyIds.has(i.id)));
  let sent = 0, failed = 0;
  let skipped = onlyIds ? invitees.filter((i) => onlyIds.has(i.id) && !!i.initialInviteSentAt).length : 0;
  for (const i of targets) {
    const tpl = renderBtlFromTexts(texts, { name: i.name, email: i.email }, ctx);
    const outcome = await deliverBtlEmail({ email: i.email, inviteeId: i.id }, "initial_invite", tpl);
    if (outcome === "sent") {
      sent++;
      await storage.updateBtlInvitee(i.id, { initialInviteSentAt: new Date() });
      await btlSendPause();
    } else if (outcome === "skipped") {
      skipped++;
      await storage.updateBtlInvitee(i.id, { initialInviteSentAt: new Date() });
    } else failed++;
  }
  return { sent, skipped, failed, total: targets.length };
}

/** Cron hook: run every scheduled send whose time has come. */
export async function runDueScheduledSends(): Promise<Array<{ id: number; kind: string; status: string; message: string }>> {
  const due = await storage.claimDueBtlScheduledSends(new Date());
  const out: Array<{ id: number; kind: string; status: string; message: string }> = [];
  for (const row of due) {
    try {
      if (row.kind === "person") {
        const r = await sendTemplateToPerson(row.templateKey, row.recipientName || "", row.recipientEmail || "", parseCcList(row.cc), await loadSendExtras(row.id));
        if (r.ok) {
          await storage.finishBtlScheduledSend(row.id, "sent", `Sent to ${row.recipientEmail}`);
          out.push({ id: row.id, kind: row.kind, status: "sent", message: `Sent to ${row.recipientEmail}` });
        } else {
          await storage.finishBtlScheduledSend(row.id, "failed", r.error);
          out.push({ id: row.id, kind: row.kind, status: "failed", message: r.error });
        }
      } else {
        const ids = new Set<number>((JSON.parse(row.inviteeIds || "[]") as unknown[]).map(Number).filter(Number.isFinite));
        const r = await sendInitialInvites(ids.size > 0 ? ids : null);
        const msg = `${r.sent} sent${r.failed ? `, ${r.failed} failed` : ""}${r.skipped ? `, ${r.skipped} already had it` : ""}`;
        await storage.finishBtlScheduledSend(row.id, r.failed > 0 && r.sent === 0 ? "failed" : "sent", msg);
        out.push({ id: row.id, kind: row.kind, status: r.failed > 0 && r.sent === 0 ? "failed" : "sent", message: msg });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 300) : "unknown error";
      await storage.finishBtlScheduledSend(row.id, "failed", msg);
      out.push({ id: row.id, kind: row.kind, status: "failed", message: msg });
    }
  }
  return out;
}
