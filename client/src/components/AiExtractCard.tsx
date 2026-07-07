import { useRef, useState } from "react";
import { Sparkles, Upload, Loader2, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * AI-prefill card — shared across every submission form on the site.
 *
 * User uploads a flyer / screenshot / poster → server hits Gemini 2.5
 * Flash Lite → returns extracted fields as an object. Parent form
 * receives the object via `onExtracted` and maps it to its own state.
 *
 * The extracted shape is a superset — page submissions only need a few
 * fields, /book needs more. Each form pulls only what it uses and
 * ignores the rest. Anything the model couldn't determine comes back
 * null so parent forms know to skip the update for that field.
 */
export interface ExtractedEvent {
  eventName: string | null;
  eventDate: string | null;      // YYYY-MM-DD
  eventTime: string | null;      // "9:00 PM"
  venue: string | null;
  city: string | null;
  instagramHandle: string | null; // no @
  ticketUrl: string | null;
  description: string | null;
}

interface Props {
  onExtracted: (fields: ExtractedEvent) => void;
  /** Optional label override — defaults to a general "flyer or screenshot" wording. */
  label?: string;
  className?: string;
}

export function AiExtractCard({ onExtracted, label, className = "" }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setSuccess(null);
    setBusy(true);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/ai/extract-event", {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `${res.status}`);
      }
      const extracted = data.extracted as ExtractedEvent;
      const filled = Object.entries(extracted).filter(([, v]) => v && String(v).trim()).length;
      onExtracted(extracted);
      setSuccess(`Prefilled ${filled} field${filled === 1 ? "" : "s"} — review and edit anything wrong before submitting.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Extraction failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
    setSuccess(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={`rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 p-4 sm:p-5 ${className}`} data-testid="ai-extract-card">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-white text-base sm:text-lg leading-tight">
            Have a flyer? Let AI fill this out
          </h3>
          <p className="text-xs sm:text-sm text-white/70 mt-1">
            {label || "Upload a screenshot, poster, or event flyer — we'll auto-fill the form. You can edit anything wrong before submitting."}
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        data-testid="ai-extract-file-input"
      />

      {!previewUrl && !busy && (
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full bg-primary hover:bg-primary/90 h-10"
          data-testid="button-ai-extract-pick"
        >
          <Upload className="w-4 h-4 mr-2" /> Upload flyer or screenshot
        </Button>
      )}

      {busy && (
        <div className="flex items-center justify-center gap-2 py-4 text-white/80 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Reading your image…
        </div>
      )}

      {previewUrl && !busy && (
        <div className="flex items-start gap-3">
          <img src={previewUrl} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-white/20 shrink-0" />
          <div className="flex-1 space-y-2">
            {success && (
              <div className="flex items-start gap-1.5 text-xs text-green-300 bg-green-500/10 border border-green-500/30 rounded-lg p-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-1.5 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                <X className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} className="border-white/20 text-white/80 hover:bg-white/10 h-8 text-xs" data-testid="button-ai-extract-replace">
                Try a different image
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={clear} className="text-white/50 hover:text-white h-8 text-xs" data-testid="button-ai-extract-clear">
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
