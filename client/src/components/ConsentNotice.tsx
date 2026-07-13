import { Link } from "wouter";
import { cn } from "@/lib/utils";

/**
 * Consent disclosure shown under every email signup form. Tells people
 * exactly what they're agreeing to before we collect their address —
 * what we'll send, how often, and how to opt out.
 */
/**
 * Explicit newsletter opt-in for forms whose main purpose isn't subscribing
 * (bookings, watch-party/venue submissions). People only join the list when
 * they leave this ticked — no more silent auto-subscribes.
 */
export function NewsletterOptIn({
  checked,
  onChange,
  className,
  testId,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  testId?: string;
}) {
  return (
    <label className={cn("flex items-start gap-2.5 cursor-pointer select-none", className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-primary cursor-pointer"
        data-testid={testId || "checkbox-newsletter-opt-in"}
      />
      <span className="text-xs leading-relaxed text-white/60">
        Also send me the free weekly NJ events newsletter. Unsubscribe anytime — every
        email includes a one-click link.{" "}
        <Link href="/legal/privacy" className="underline hover:text-white/90">
          Privacy Policy
        </Link>
      </span>
    </label>
  );
}

export function ConsentNotice({ className }: { className?: string }) {
  return (
    <p className={cn("text-[11px] leading-relaxed text-white/40", className)}>
      By subscribing you agree to receive the free weekly CGE events email.
      Every email includes a one-click unsubscribe link — opt out anytime.{" "}
      <Link href="/legal/privacy" className="underline hover:text-white/70">
        Privacy Policy
      </Link>
    </p>
  );
}
