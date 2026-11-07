import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Upload, X } from "lucide-react";
import { easternToday, submitAssistantEventSchema, type AssistantEventSubmission } from "@shared/assistant";

type Result = { id: number; message: string };
type Props = { submitEvent: (data: AssistantEventSubmission) => Promise<Result | null>; loading: boolean; error: string | null; onClose: () => void };

export function AssistantSubmissionForm({ submitEvent, loading, error, onClose }: Props) {
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const uploadAbort = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    mounted.current = true;
    heading.current?.focus({ preventScroll: true });
    return () => { mounted.current = false; uploadAbort.current?.abort(); };
  }, []);

  async function upload(file?: File) {
    if (!file) return;
    setUploadError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setUploadError("Choose a JPG, PNG, or WebP file no larger than 5MB."); return;
    }
    uploadAbort.current?.abort();
    const controller = new AbortController();
    uploadAbort.current = controller;
    setUploading(true);
    const timer = window.setTimeout(() => controller.abort(), 45000);
    try {
      const body = new FormData(); body.append("file", file);
      const response = await fetch("/api/assistant/upload-flyer", { method: "POST", body, credentials: "include", signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.message === "string" ? data.message : "Flyer upload failed. Choose the file again to retry, or continue without it.");
      const parsed = submitAssistantEventSchema.shape.imageUrl.safeParse(data.url);
      if (!parsed.success || !parsed.data) throw new Error("The upload did not return a valid flyer URL. Please try again.");
      if (mounted.current) setImageUrl(parsed.data);
    } catch (err) {
      if (mounted.current) setUploadError(err instanceof Error && err.name !== "AbortError" ? err.message : "Upload timed out. Choose the file again to retry.");
    } finally {
      window.clearTimeout(timer);
      if (mounted.current && uploadAbort.current === controller) setUploading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || uploading || loading) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    delete values.flyer;
    const parsed = submitAssistantEventSchema.safeParse({ ...values, imageUrl });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach(issue => { next[String(issue.path[0])] = issue.message; });
      setIssues(next);
      const first = form.elements.namedItem(parsed.error.issues[0].path[0] as string);
      if (first instanceof HTMLElement) first.focus();
      return;
    }
    setIssues({}); busy.current = true; setSubmitting(true);
    try { const success = await submitEvent(parsed.data); if (mounted.current && success) setResult(success); }
    finally { busy.current = false; if (mounted.current) setSubmitting(false); }
  }

  const field = (name: string, label: string, type = "text", required = false, extra: Record<string, string | number> = {}) => (
    <div key={name}>
      <label htmlFor={`cge-submit-${name}`} className="mb-2 block text-sm font-medium">{label}{required ? " *" : ""}</label>
      <input className="cge-assistant-field" id={`cge-submit-${name}`} name={name} type={type} required={required} aria-invalid={!!issues[name]} aria-describedby={issues[name] ? `cge-error-${name}` : undefined} {...extra} />
      {issues[name] && <p id={`cge-error-${name}`} className="mt-1 text-sm text-red-300">{issues[name]}</p>}
    </div>
  );

  return (
    <section aria-labelledby="cge-submit-heading" className="rounded-2xl border border-accent/25 bg-secondary/20 p-5 sm:p-8 cge-assistant-enter">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-accent">For the people making plans happen</p><h2 id="cge-submit-heading" ref={heading} tabIndex={-1} className="text-2xl sm:text-3xl">Put your event on the radar.</h2><p className="mt-2 text-sm text-muted-foreground">Tell Jersey where to be. Fields marked * are required.</p></div>
        <button type="button" onClick={onClose} disabled={loading || uploading || submitting} aria-label="Close event submission" className="rounded-lg p-2 hover:bg-secondary"><X className="h-5 w-5" /></button>
      </div>
      {result ? <div role="status" className="rounded-xl border border-accent/30 bg-accent/5 p-6"><CheckCircle2 className="mb-3 h-7 w-7 text-accent" /><h3 className="text-xl">Your event is in.</h3><p className="mt-2 text-sm text-muted-foreground">{result.message} Event #{result.id}.</p><button type="button" onClick={onClose} className="mt-5 rounded-lg bg-accent px-5 py-3 font-semibold text-accent-foreground">Back to finding plans</button></div> :
        <form onSubmit={onSubmit}>
          <fieldset disabled={loading || submitting} className="space-y-5">
            <div className="rounded-xl border border-dashed border-white/20 p-4">
              <label htmlFor="cge-flyer" className="mb-2 flex items-center gap-2 text-sm font-semibold"><Upload className="h-4 w-4 text-accent" />Event flyer (optional)</label>
              <p id="cge-flyer-help" className="mb-3 text-xs text-muted-foreground">JPG, PNG, or WebP, up to 5MB. No flyer? You can still submit.</p>
              <input id="cge-flyer" name="flyer" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} aria-describedby="cge-flyer-help cge-upload-status" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-foreground" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
              <p id="cge-upload-status" role="status" className="mt-2 text-sm text-accent">{uploading ? "Uploading your flyer…" : imageUrl ? "Flyer uploaded." : ""}</p>
              {uploadError && <p role="alert" className="mt-2 text-sm text-red-300">{uploadError}</p>}
              {imageUrl && !uploading && <button type="button" className="mt-2 text-xs underline underline-offset-4" onClick={() => { setImageUrl(""); setUploadError(""); }}>Remove flyer</button>}
            </div>
            {field("title", "Event title", "text", true, { maxLength: 180 })}
            <div className="grid gap-5 md:grid-cols-2">{field("date", "Date", "date", true, { min: easternToday() })}{field("eventTime", "Time (Eastern)", "time")}</div>
            <div className="grid gap-5 md:grid-cols-2">
              <div><label htmlFor="cge-submit-region" className="mb-2 block text-sm font-medium">Region *</label><select id="cge-submit-region" name="region" required defaultValue="" className="cge-assistant-field" aria-invalid={!!issues.region}><option value="" disabled>Choose a region</option>{["North NJ", "Central NJ", "South NJ"].map(region => <option key={region}>{region}</option>)}</select>{issues.region && <p className="mt-1 text-sm text-red-300">{issues.region}</p>}</div>
              {field("city", "City", "text", true, { maxLength: 100 })}
            </div>
            {field("venue", "Venue", "text", true, { maxLength: 180 })}
            <div><label htmlFor="cge-submit-description" className="mb-2 block text-sm font-medium">Description (optional)</label><textarea id="cge-submit-description" name="description" rows={3} maxLength={4000} className="cge-assistant-field" placeholder="The vibe, the lineup, the details people should know." /></div>
            {field("genre", "Genre / event type (optional)", "text", false, { maxLength: 100 })}
            <div className="grid gap-5 md:grid-cols-2">{field("ticketLink", "Ticket link (optional)", "url", false, { placeholder: "https://", maxLength: 2000 })}{field("instagramHandle", "Instagram handle (optional)", "text", false, { placeholder: "@yourhandle", maxLength: 31 })}</div>
            {field("organizerEmail", "Organizer email", "email", true, { autoComplete: "email", maxLength: 254 })}
            <p className="text-xs leading-relaxed text-muted-foreground">By submitting, you agree to publish your event details in the CGE catalog. Your organizer email stays private and is only used to contact you about this event.</p>
            {error && <p role="alert" className="rounded-lg border border-red-300/25 p-3 text-sm text-red-300">{error} Your details are still here. Try submitting again.</p>}
            <button type="submit" disabled={loading || submitting || uploading} className="min-h-12 w-full rounded-xl bg-accent px-6 py-3 font-bold text-accent-foreground hover:bg-accent/90 sm:w-auto">{uploading ? "Waiting for flyer…" : loading || submitting ? "Submitting your event…" : error ? "Try submitting again" : "Submit my event"}</button>
          </fieldset>
        </form>}
    </section>
  );
}
