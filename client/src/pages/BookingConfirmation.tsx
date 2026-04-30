import { useEffect, useState } from "react";
import { CheckCircle2, Instagram, Mail, Calendar, MapPin, ArrowRight } from "lucide-react";
import { SiCashapp } from "react-icons/si";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";

interface BookingSummary {
  mode: string;
  budgetRange: string;
  eventName: string;
  eventType: string;
  eventTypeOther: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
  city: string;
  region: string;
  contactName: string;
  email: string;
  instagramHandle: string;
}

const NEXT_STEPS = [
  {
    number: "01",
    title: "Payment Confirmation",
    description: "We'll verify your CashApp payment and send you a confirmation email within 24 hours.",
  },
  {
    number: "02",
    title: "Content Review",
    description: "Our team reviews your event details and begins crafting your promotional content.",
  },
  {
    number: "03",
    title: "Your Event Goes Live",
    description: "We post across our platforms on your scheduled date. Sit back and watch the buzz build.",
  },
];

const BASIC_NEXT_STEPS = [
  {
    number: "01",
    title: "Submission Review",
    description: "Our team reviews your event details and confirms whether it can be listed in the calendar.",
  },
  {
    number: "02",
    title: "Calendar Placement",
    description: "If approved, your event is added to the Central Group Events calendar for the selected week.",
  },
  {
    number: "03",
    title: "Upgrade Opportunity",
    description: "Paid promotion unlocks wider reach, premium placement, and more social amplification next time.",
  },
];

function SummaryRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      {icon && <span className="text-primary mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">
        <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-white font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

export default function BookingConfirmation() {
  const [booking, setBooking] = useState<BookingSummary | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("cge_booking_summary");
      if (raw) {
        setBooking(JSON.parse(raw));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const packageLabel = booking ? `${booking.mode} — ${booking.budgetRange}` : null;
  const eventDisplayType =
    booking?.eventType === "Other" ? booking.eventTypeOther : booking?.eventType;
  const nextSteps = booking?.mode === "Basic" ? BASIC_NEXT_STEPS : NEXT_STEPS;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Booking Confirmed — Central Group Events"
        description="Your event promotion booking has been submitted. See what happens next."
        canonical="https://www.centralgroupevents.com/booking-confirmation"
        noindex
      />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-primary" />
            </div>
          </div>
          <h1
            className="text-4xl md:text-5xl font-black text-white mb-4"
            data-testid="confirmation-heading"
          >
            You're all set!
          </h1>
          <p
            className="text-lg text-muted-foreground leading-relaxed"
            data-testid="confirmation-message"
          >
            {booking?.contactName
              ? `Thanks, ${booking.contactName}! Your booking has been submitted.`
              : "Thank you! Your booking has been submitted."}
          </p>
          {booking?.email && (
            <p className="text-sm text-white/40 mt-2">
              We'll reach out at <span className="text-white/70">{booking.email}</span>
            </p>
          )}
        </div>

        {/* Order Summary */}
        {booking && (
          <div
            className="glass-panel rounded-3xl border border-white/10 p-6 md:p-8 mb-8"
            data-testid="section-order-summary"
          >
            <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-5">
              Order Summary
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <SummaryRow label="Package" value={packageLabel ?? ""} />
              <SummaryRow label="Contact" value={booking.contactName} />
              <SummaryRow label="Event" value={booking.eventName} />
              {eventDisplayType && (
                <SummaryRow label="Event Type" value={eventDisplayType} />
              )}
              <SummaryRow
                label="Date & Time"
                value={[booking.eventDate, booking.eventTime].filter(Boolean).join(" at ")}
                icon={<Calendar className="w-4 h-4" />}
              />
              <SummaryRow
                label="Venue"
                value={[booking.venueName, booking.city].filter(Boolean).join(", ")}
                icon={<MapPin className="w-4 h-4" />}
              />
              {booking.region && (
                <SummaryRow label="Region" value={booking.region} />
              )}
              {booking.instagramHandle && (
                <SummaryRow
                  label="Instagram"
                  value={`@${booking.instagramHandle}`}
                  icon={<Instagram className="w-4 h-4" />}
                />
              )}
            </div>
          </div>
        )}

        {/* What Happens Next */}
        <div
          className="glass-panel rounded-3xl border border-white/10 p-6 md:p-8 mb-8"
          data-testid="section-next-steps"
        >
          <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-6">
            What Happens Next
          </h2>
          <div className="space-y-6">
            {nextSteps.map((s, i) => (
              <div key={s.number} className="flex gap-4">
                <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <span className="text-xs font-black text-primary">{s.number}</span>
                </div>
                <div className="pt-1">
                  <p className="font-bold text-white mb-0.5" data-testid={`next-step-title-${i + 1}`}>
                    {s.title}
                  </p>
                  <p className="text-sm text-white/50 leading-relaxed">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {booking?.mode === "Basic" ? (
          <div
            className="rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-6 md:p-8 mb-8"
            data-testid="section-paid-upgrade-note"
          >
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-12 h-12 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center">
                <span className="text-yellow-200 font-bold">!</span>
              </div>
              <div>
                <h2 className="font-bold text-white mb-1">Basic calendar listing confirmed</h2>
                <p className="text-sm text-white/80 mb-4 leading-relaxed">
                  Your event submission is saved and will be reviewed for calendar placement.
                  Paid promotion unlocks wider reach, better visibility, and stronger social amplification
                  on the next campaign.
                </p>
                <ul className="list-disc list-inside space-y-2 text-xs text-white/75">
                  <li>Priority placement across our newsletter and event hub</li>
                  <li>Instagram reels, targeted social promotion, and ads</li>
                  <li>SMS blasts to engaged subscribers</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="rounded-3xl border border-[#00D632]/20 bg-[#00D632]/5 p-6 md:p-8 mb-8"
            data-testid="section-cashapp-reminder"
          >
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-12 h-12 rounded-full bg-[#00D632]/10 border border-[#00D632]/30 flex items-center justify-center">
                <SiCashapp className="w-6 h-6 text-[#00D632]" />
              </div>
              <div>
                <h2 className="font-bold text-white mb-1">If you haven't paid yet…</h2>
                <p className="text-sm text-white/60 mb-4 leading-relaxed">
                  Your booking is saved, but your promotion won't be scheduled until payment is
                  received. Send{' '}
                  {booking?.budgetRange ? (
                    <span className="text-white font-semibold">{booking.budgetRange}</span>
                  ) : (
                    'your package amount'
                  )}{' '}
                  to <span className="text-[#00D632] font-semibold">$centralgroupevents</span> on
                  CashApp and include your event name in the note.
                </p>
                <a
                  href="https://cash.app/$centralgroupevents"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="button-cashapp-pay"
                  className="inline-flex items-center gap-2 bg-[#00D632] hover:bg-[#00D632]/90 text-black font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
                >
                  <SiCashapp className="w-4 h-4" />
                  Pay via CashApp
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Social Links */}
        <div
          className="glass-panel rounded-3xl border border-white/10 p-6 md:p-8 mb-10"
          data-testid="section-social-links"
        >
          <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">
            Stay Connected
          </h2>
          <p className="text-sm text-white/60 mb-5">
            Follow us to stay up to date on your promotion and see how we showcase NJ events.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="https://www.instagram.com/centralgroupevents"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-instagram"
              className="flex items-center gap-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-sm px-5 py-3 rounded-xl transition-colors"
            >
              <Instagram className="w-4 h-4 text-pink-400" />
              @centralgroupevents
            </a>
            <a
              href="mailto:centralgroupevents@gmail.com"
              data-testid="link-email"
              className="flex items-center gap-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-sm px-5 py-3 rounded-xl transition-colors"
            >
              <Mail className="w-4 h-4 text-primary" />
              centralgroupevents@gmail.com
            </a>
          </div>
        </div>

        {/* Back to Home CTA */}
        <div className="text-center">
          <Link href="/">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-full px-10"
              data-testid="button-back-home"
            >
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
