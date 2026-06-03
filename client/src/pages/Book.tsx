import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Check } from "lucide-react";
import { Link, useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { apiRequest } from "@/lib/queryClient";
import cgeLogo from "@assets/CGE_logo_1772075137138.png";

// ─── T&C content (verbatim from existing modal) ─────────────────────────────

const TERMS_SECTIONS = [
  {
    heading: "Please Read Before Proceeding",
    body: "Thank you for submitting your event to be featured on Central Group Events. By completing this form, you acknowledge that you have read, understood, and agree to the terms outlined below. Central Group Events reserves the right to accept or decline any submission at its sole discretion.",
  },
  {
    heading: "Submission Deadlines",
    body: "All event promotion submissions are subject to a minimum 7-day lead time prior to the event date. Central Group Events operates on a weekly posting schedule, and available slots fill quickly. Submissions are accepted on a first-come, first-served basis. If your event coincides with a special occasion, holiday, or time-sensitive date, we strongly recommend submitting at least 2 weeks in advance and noting the time-sensitive nature in your submission. Late submissions may not be accommodated, and Central Group Events is not responsible for events that cannot be featured due to timing.",
  },
  {
    heading: "Inclusion Policy",
    body: "Central Group Events is a curated platform. A limited number of events may be featured in any given week, and submission does not guarantee inclusion. Factors that may affect inclusion include, but are not limited to: paid promotion slots being filled for the requested week, incomplete or missing submission information, unclear event concepts, insufficient contact details, or content determined by our staff to be unsafe, inappropriate, or inconsistent with our community standards.",
  },
  {
    heading: "Paid Promotions",
    body: "By selecting a paid promotion package, you agree to be contacted by Central Group Events via the email address provided to confirm your promotion details, schedule a posting date, and receive an invoice for payment. Promotion content will be created and scheduled following confirmation and payment. Central Group Events may, at its discretion, arrange to personally experience your event or service prior to promotion. All paid promotions are subject to availability.",
  },
  {
    heading: "Brand Partnerships",
    body: "This submission form is intended for individual promoters and community-level organizations. Large brands or organizations seeking broader partnership opportunities are encouraged to reach out directly via email at centralgroupevents@gmail.com for custom pricing and partnership inquiries. Submissions from large brands through this form may not be processed.",
  },
  {
    heading: "Contact",
    body: "For questions regarding your submission or these terms, please contact us at centralgroupevents@gmail.com.",
  },
];

// ─── Packages ────────────────────────────────────────────────────────────────

const PACKAGES = [
  {
    id: "Basic",
    label: "Basic",
    price: "FREE",
    badge: null,
    features: ["Event calendar listing"],
    testId: "card-package-basic",
  },
  {
    id: "Starter",
    label: "Starter",
    price: "$70",
    badge: null,
    features: ["Event calendar listing", "Instagram story feature", "Newsletter mention", "Facebook post"],
    testId: "card-package-starter",
  },
  {
    id: "Growth",
    label: "Growth",
    price: "$150",
    badge: "Most Popular",
    features: ["Everything in Starter", "Instagram reel feature", "Premium newsletter placement", "SMS blast to subscribers"],
    testId: "card-package-growth",
  },
  {
    id: "Custom",
    label: "Custom",
    price: "$300+",
    badge: null,
    features: ["Everything in Growth", "Influencer reposts", "Strategy call included", "Custom campaign timeline"],
    testId: "card-package-custom",
  },
];

const EVENT_TYPES = [
  "Club Night",
  "Concert",
  "Day Party",
  "Festival",
  "Brunch",
  "Networking Event",
  "Comedy Show",
  "Pop-Up",
  "Lounge Event",
  "Other",
];

// ─── Form state type ──────────────────────────────────────────────────────────

interface WizardData {
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
  phone: string;
  instagramHandle: string;
  agreedToTerms: boolean;
}

const INITIAL_DATA: WizardData = {
  mode: "",
  budgetRange: "",
  eventName: "",
  eventType: "",
  eventTypeOther: "",
  eventDate: "",
  eventTime: "",
  venueName: "",
  city: "",
  region: "",
  contactName: "",
  email: "",
  phone: "",
  instagramHandle: "",
  agreedToTerms: false,
};

// ─── Steps config ────────────────────────────────────────────────────────────

const STEPS = ["Package", "Event Details", "Logistics", "Contact Info", "Terms", "Payment"];

// Logical steps (some have sub-steps)
// 0 = Package
// 1 = Event Details
// 2a = Date & Time
// 2b = Venue & Location
// 3a = Contact Name & Email
// 3b = Phone & Instagram
// 4 = Terms
// 5 = Payment
type SubStep = "main" | "a" | "b";

interface StepState {
  step: number; // 0-5
  subStep: SubStep;
}

function stepToLogical(s: StepState): number {
  if (s.step < 2) return s.step;
  if (s.step === 2) return s.subStep === "a" ? 2 : 3;
  if (s.step === 3) return s.subStep === "a" ? 4 : 5;
  if (s.step === 4) return 6;
  return 7;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-red-400 text-sm mt-1">{msg}</p>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

function getPackageFromParam(): { mode: string; budgetRange: string } {
  const param = new URLSearchParams(window.location.search).get("package")?.toLowerCase();
  if (param === "basic") return { mode: "Basic", budgetRange: "FREE" };
  if (param === "starter") return { mode: "Starter", budgetRange: "$70" };
  if (param === "growth") return { mode: "Growth", budgetRange: "$150" };
  if (param === "custom") return { mode: "Custom", budgetRange: "$300+" };
  return { mode: "", budgetRange: "" };
}

export default function Book() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [stepState, setStepState] = useState<StepState>({ step: 0, subStep: "main" });
  const [data, setData] = useState<WizardData>(() => ({
    ...INITIAL_DATA,
    ...getPackageFromParam(),
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof WizardData, string>>>({});
  const [touched, setTouched] = useState<Set<keyof WizardData>>(new Set());
  const [direction, setDirection] = useState<1 | -1>(1);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const hasSavedRef = useRef(false);
  const sessionIdRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36),
  );

  const { step, subStep } = stepState;

  // Fire a funnel event whenever the user reaches a new top-level step.
  // Steps map to STEPS labels: 0=Package, 1=Event Details, 2=Logistics, 3=Contact Info, 4=Terms, 5=Payment.
  useEffect(() => {
    const label = STEPS[step] ?? `step-${step}`;
    fetch("/api/funnel/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: label, sessionId: sessionIdRef.current }),
      keepalive: true,
    }).catch(() => {});
  }, [step]);

  // ── Progress helpers ──────────────────────────────────────────────────────

  function getProgressStep(): number {
    return step; // 0-5 maps to circles 1-6
  }

  function isStepComplete(i: number) {
    return i < step;
  }

  function canGoToStep(i: number) {
    return i < step;
  }

  // ── Real-time step validity (drives disabled state of Next button) ─────────

  function isCurrentStepValid(): boolean {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
    if (step === 0) return !!data.mode;
    if (step === 1) {
      const baseOk = !!data.eventName.trim() && !!data.eventType;
      const otherOk = data.eventType !== "Other" || !!data.eventTypeOther.trim();
      return baseOk && otherOk;
    }
    if (step === 2) {
      if (subStep === "a") return !!data.eventDate && !!data.eventTime;
      return !!data.venueName.trim() && !!data.city.trim() && !!data.region;
    }
    if (step === 3) {
      if (subStep === "a") return !!data.contactName.trim() && emailOk;
      const phoneRequired = data.mode === "Growth" || data.mode === "Custom";
      const phoneOk = !phoneRequired || !!data.phone.trim();
      return phoneOk && !!data.instagramHandle.trim();
    }
    if (step === 4) return data.agreedToTerms;
    return true;
  }

  const currentStepValid = isCurrentStepValid();

  // ── Navigation ────────────────────────────────────────────────────────────

  function goToStep(i: number) {
    if (!canGoToStep(i)) return;
    setDirection(i < step ? -1 : 1);
    setStepState({ step: i, subStep: i === 2 || i === 3 ? "a" : "main" });
    setErrors({});
  }

  function advance(toSubStep?: SubStep) {
    setDirection(1);
    setErrors({});
    setTouched(new Set());
    if (toSubStep) {
      setStepState((s) => ({ ...s, subStep: toSubStep }));
    } else {
      setStepState((s) => ({ step: s.step + 1, subStep: s.step + 1 === 2 || s.step + 1 === 3 ? "a" : "main" }));
    }
  }

  function retreat(toSubStep?: SubStep) {
    setDirection(-1);
    setErrors({});
    setTouched(new Set());
    if (toSubStep) {
      setStepState((s) => ({ ...s, subStep: toSubStep }));
    } else {
      if (step === 0) return;
      const prevStep = step - 1;
      setStepState({ step: prevStep, subStep: prevStep === 2 || prevStep === 3 ? "b" : "main" });
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validateAndNext() {
    const errs: Partial<Record<keyof WizardData, string>> = {};

    if (step === 0) {
      if (!data.mode) errs.mode = "Please select a package";
    } else if (step === 1) {
      if (!data.eventName.trim()) errs.eventName = "Event name is required";
      if (!data.eventType) errs.eventType = "Event type is required";
      if (data.eventType === "Other" && !data.eventTypeOther.trim())
        errs.eventTypeOther = "Please describe your event type";
    } else if (step === 2) {
      if (subStep === "a") {
        if (!data.eventDate) errs.eventDate = "Event date is required";
        if (!data.eventTime) errs.eventTime = "Event time is required";
      } else {
        if (!data.venueName.trim()) errs.venueName = "Venue name is required";
        if (!data.city.trim()) errs.city = "City is required";
        if (!data.region) errs.region = "Region is required";
      }
    } else if (step === 3) {
      if (subStep === "a") {
        if (!data.contactName.trim()) errs.contactName = "Contact name is required";
        if (!data.email.trim()) errs.email = "Email is required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
          errs.email = "Enter a valid email address";
      } else {
        const phoneRequired = data.mode === "Growth" || data.mode === "Custom";
        if (phoneRequired && !data.phone.trim()) errs.phone = "Phone number is required";
        if (!data.instagramHandle.trim()) errs.instagramHandle = "Instagram handle is required";
      }
    } else if (step === 4) {
      if (!data.agreedToTerms) errs.agreedToTerms = "You must agree to the Terms & Conditions";
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    // Advance sub-steps or main step
    if (step === 2 && subStep === "a") {
      advance("b");
    } else if (step === 3 && subStep === "a") {
      advance("b");
    } else {
      advance();
    }
  }

  function handleBack() {
    if (step === 2 && subStep === "b") {
      retreat("a");
    } else if (step === 3 && subStep === "b") {
      retreat("a");
    } else {
      retreat();
    }
  }

  // ── Auto-save on Step 6 ───────────────────────────────────────────────────

  useEffect(() => {
    if (step !== 5 || hasSavedRef.current) return;
    hasSavedRef.current = true;
    setSaveStatus("saving");

    const payload = {
      mode: data.mode,
      budgetRange: data.budgetRange,
      eventName: data.eventName,
      eventType: data.eventType,
      eventTypeOther: data.eventType === "Other" ? data.eventTypeOther : undefined,
      eventDate: data.eventDate,
      eventTime: data.eventTime,
      venueName: data.venueName,
      city: data.city,
      region: data.region,
      contactName: data.contactName,
      email: data.email,
      phone: data.phone || undefined,
      instagramHandle: data.instagramHandle,
    };

    apiRequest("POST", "/api/bookings", payload)
      .then(async (res) => {
        let referenceId: string | undefined;
        try {
          const json = await res.json();
          referenceId = json.referenceId;
        } catch {
          // ignore parse errors
        }
        try {
          sessionStorage.setItem(
            "cge_booking_summary",
            JSON.stringify({
              referenceId,
              mode: data.mode,
              budgetRange: data.budgetRange,
              eventName: data.eventName,
              eventType: data.eventType,
              eventTypeOther: data.eventTypeOther,
              eventDate: data.eventDate,
              eventTime: data.eventTime,
              venueName: data.venueName,
              city: data.city,
              region: data.region,
              contactName: data.contactName,
              email: data.email,
              instagramHandle: data.instagramHandle,
            })
          );
        } catch {
          // ignore storage errors
        }
        setSaveStatus("saved");
        fetch("/api/funnel/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: "Submitted", sessionId: sessionIdRef.current, metadata: { mode: data.mode, referenceId } }),
          keepalive: true,
        }).catch(() => {});
      })
      .catch((err) => {
        setSaveStatus("error");
        toast({
          variant: "destructive",
          title: "Booking save failed",
          description: err.message || "We couldn't save your booking. Please email us directly.",
        });
      });
  }, [step]);

  // ── Update & touch helpers ────────────────────────────────────────────────

  function set<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  function touch(key: keyof WizardData) {
    setTouched((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set<keyof WizardData>();
      prev.forEach((k) => next.add(k));
      next.add(key);
      return next;
    });
  }

  function getFieldError(key: keyof WizardData): string | undefined {
    if (errors[key]) return errors[key];
    if (!touched.has(key)) return undefined;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
    switch (key) {
      case "mode": return !data.mode ? "Please select a package" : undefined;
      case "eventName": return !data.eventName.trim() ? "Event name is required" : undefined;
      case "eventType": return !data.eventType ? "Event type is required" : undefined;
      case "eventTypeOther": return data.eventType === "Other" && !data.eventTypeOther.trim() ? "Please describe your event type" : undefined;
      case "eventDate": return !data.eventDate ? "Event date is required" : undefined;
      case "eventTime": return !data.eventTime ? "Event time is required" : undefined;
      case "venueName": return !data.venueName.trim() ? "Venue name is required" : undefined;
      case "city": return !data.city.trim() ? "City is required" : undefined;
      case "region": return !data.region ? "Region is required" : undefined;
      case "contactName": return !data.contactName.trim() ? "Contact name is required" : undefined;
      case "email": return !data.email.trim() ? "Email is required" : !emailOk ? "Enter a valid email address" : undefined;
      case "phone": {
        const phoneRequired = data.mode === "Growth" || data.mode === "Custom";
        return phoneRequired && !data.phone.trim() ? "Phone number is required" : undefined;
      }
      case "instagramHandle": return !data.instagramHandle.trim() ? "Instagram handle is required" : undefined;
      case "agreedToTerms": return !data.agreedToTerms ? "You must agree to the Terms & Conditions" : undefined;
      default: return undefined;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const inputClass =
    "bg-black/40 border-white/10 h-12 rounded-xl text-white placeholder:text-white/30 focus-visible:ring-primary/50";

  const logicalStep = stepToLogical(stepState);

  const subLabel =
    step === 2
      ? subStep === "a"
        ? "3a — Date & Time"
        : "3b — Venue & Location"
      : step === 3
      ? subStep === "a"
        ? "4a — Contact Details"
        : "4b — Phone & Instagram"
      : null;

  return (
    <div className="min-h-screen bg-background text-white">
      <SEO
        title="Book Event Promotion — Central Group Events"
        description="Get your NJ event promoted with Central Group Events. Choose a package and get started in minutes."
        canonical="https://www.centralgroupevents.com/book"
        noindex
      />
      <Navigation />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 pb-24">
        {/* Header */}
        <div className="text-center mb-10">
          <img src={cgeLogo} alt="CGE" className="h-12 w-auto mx-auto mb-6 object-contain" />
          <h1 className="text-3xl md:text-4xl font-black mb-2">Let's Promote Your Event</h1>
          <p className="text-muted-foreground text-lg">
            Fill out the wizard below — takes under 3 minutes.
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 right-0 top-5 h-0.5 bg-white/10 z-0" />
            {STEPS.map((label, i) => {
              const done = isStepComplete(i);
              const current = i === step;
              return (
                <button
                  key={i}
                  data-testid={`step-indicator-${i + 1}`}
                  onClick={() => goToStep(i)}
                  disabled={!done && !current}
                  className={[
                    "relative z-10 flex flex-col items-center gap-1 group",
                    done ? "cursor-pointer" : current ? "cursor-default" : "cursor-not-allowed opacity-40",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300",
                      done
                        ? "bg-primary text-white"
                        : current
                        ? "bg-transparent border-2 border-primary text-white ring-4 ring-primary/20"
                        : "bg-secondary border-2 border-white/10 text-white/40",
                    ].join(" ")}
                  >
                    {done ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={["text-xs font-medium hidden sm:block", current ? "text-white" : "text-white/40"].join(" ")}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
          {subLabel && (
            <p className="text-center text-xs text-primary/80 mt-3 font-medium tracking-wide">
              Step {step + 1} of 6 — {subLabel}
            </p>
          )}
        </div>

        {/* Wizard card */}
        <div className="glass-panel rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${step}-${subStep}`}
              initial={{ x: direction * 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction * -60, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="p-6 md:p-10"
            >
              {/* ── Step 1: Package ─────────────────────────────────────────── */}
              {step === 0 && (
                <div>
                  <h2 className="text-2xl font-black mb-1">Choose Your Package</h2>
                  <p className="text-muted-foreground text-sm mb-6">Select the plan that fits your event size and budget.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {PACKAGES.map((pkg) => (
                      <button
                        key={pkg.id}
                        data-testid={pkg.testId}
                        onClick={() => {
                          set("mode", pkg.id);
                          set("budgetRange", pkg.price);
                        }}
                        className={[
                          "flex flex-col h-full justify-start text-left border-2 rounded-2xl p-5 cursor-pointer transition-all duration-200 relative",
                          data.mode === pkg.id
                            ? "border-primary shadow-[0_0_20px_rgba(139,47,201,0.3)] bg-primary/5"
                            : "border-white/10 hover:border-primary/50 bg-black/20",
                        ].join(" ")}
                      >
                        {pkg.badge && (
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                            {pkg.badge}
                          </span>
                        )}
                        <p className="font-bold text-lg mb-1">{pkg.label}</p>
                        {pkg.price ? (
                          <p className="text-2xl font-black text-primary mb-3 min-h-[3rem]">{pkg.price}</p>
                        ) : null}
                        <ul className="space-y-1">
                          {pkg.features.map((f) => (
                            <li key={f} className="text-xs text-white/60 flex items-start gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                        {data.mode === pkg.id && (
                          <div className="absolute top-3 right-3">
                            <Check className="w-4 h-4 text-primary" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <FieldError msg={errors.mode} />
                </div>
              )}

              {/* ── Step 2: Event Details ────────────────────────────────────── */}
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-2xl font-black mb-1">Event Details</h2>
                    <p className="text-muted-foreground text-sm">Tell us about your event.</p>
                  </div>

                  <div>
                    <Label htmlFor="eventName" className="text-white/80 mb-1.5 block">Event Name *</Label>
                    <Input
                      id="eventName"
                      data-testid="input-event-name"
                      className={inputClass}
                      placeholder="e.g. Summer Rooftop Bash"
                      value={data.eventName}
                      onChange={(e) => set("eventName", e.target.value)}
                      onBlur={() => touch("eventName")}
                    />
                    <FieldError msg={getFieldError("eventName")} />
                  </div>

                  <div>
                    <Label htmlFor="eventType" className="text-white/80 mb-1.5 block">Event Type *</Label>
                    <Select value={data.eventType} onValueChange={(v) => { set("eventType", v); touch("eventType"); }}>
                      <SelectTrigger data-testid="select-event-type" className={inputClass}>
                        <SelectValue placeholder="Select event type" />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError msg={getFieldError("eventType")} />
                  </div>

                  {data.eventType === "Other" && (
                    <div>
                      <Label htmlFor="eventTypeOther" className="text-white/80 mb-1.5 block">Describe Your Event *</Label>
                      <Input
                        id="eventTypeOther"
                        data-testid="input-event-type-other"
                        className={inputClass}
                        placeholder="e.g. Charity Gala"
                        value={data.eventTypeOther}
                        onChange={(e) => set("eventTypeOther", e.target.value)}
                        onBlur={() => touch("eventTypeOther")}
                      />
                      <FieldError msg={getFieldError("eventTypeOther")} />
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 3a: Date & Time ─────────────────────────────────────── */}
              {step === 2 && subStep === "a" && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-2xl font-black mb-1">Date & Time</h2>
                    <p className="text-muted-foreground text-sm">When is your event?</p>
                  </div>

                  <div>
                    <Label htmlFor="eventDate" className="text-white/80 mb-1.5 block">Event Date *</Label>
                    <Input
                      id="eventDate"
                      data-testid="input-event-date"
                      type="date"
                      className={inputClass}
                      value={data.eventDate}
                      onChange={(e) => set("eventDate", e.target.value)}
                      onBlur={() => touch("eventDate")}
                    />
                    <FieldError msg={getFieldError("eventDate")} />
                  </div>

                  <div>
                    <Label htmlFor="eventTime" className="text-white/80 mb-1.5 block">Event Time *</Label>
                    <Input
                      id="eventTime"
                      data-testid="input-event-time"
                      type="time"
                      className={inputClass}
                      value={data.eventTime}
                      onChange={(e) => set("eventTime", e.target.value)}
                      onBlur={() => touch("eventTime")}
                    />
                    <FieldError msg={getFieldError("eventTime")} />
                  </div>
                </div>
              )}

              {/* ── Step 3b: Venue & Location ────────────────────────────────── */}
              {step === 2 && subStep === "b" && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-2xl font-black mb-1">Venue & Location</h2>
                    <p className="text-muted-foreground text-sm">Where is your event happening?</p>
                  </div>

                  <div>
                    <Label htmlFor="venueName" className="text-white/80 mb-1.5 block">Venue Name *</Label>
                    <Input
                      id="venueName"
                      data-testid="input-venue-name"
                      className={inputClass}
                      placeholder="e.g. Club Luxe"
                      value={data.venueName}
                      onChange={(e) => set("venueName", e.target.value)}
                      onBlur={() => touch("venueName")}
                    />
                    <FieldError msg={getFieldError("venueName")} />
                  </div>

                  <div>
                    <Label htmlFor="city" className="text-white/80 mb-1.5 block">City *</Label>
                    <Input
                      id="city"
                      data-testid="input-city"
                      className={inputClass}
                      placeholder="e.g. Newark"
                      value={data.city}
                      onChange={(e) => set("city", e.target.value)}
                      onBlur={() => touch("city")}
                    />
                    <FieldError msg={getFieldError("city")} />
                  </div>

                  <div>
                    <Label htmlFor="region" className="text-white/80 mb-1.5 block">Region *</Label>
                    <Select value={data.region} onValueChange={(v) => { set("region", v); touch("region"); }}>
                      <SelectTrigger data-testid="select-region" className={inputClass}>
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="North NJ">North NJ</SelectItem>
                        <SelectItem value="Central NJ">Central NJ</SelectItem>
                        <SelectItem value="South NJ">South NJ</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldError msg={getFieldError("region")} />
                  </div>
                </div>
              )}

              {/* ── Step 4a: Contact Name & Email ─────────────────────────────── */}
              {step === 3 && subStep === "a" && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-2xl font-black mb-1">Contact Details</h2>
                    <p className="text-muted-foreground text-sm">Who should we reach out to?</p>
                  </div>

                  <div>
                    <Label htmlFor="contactName" className="text-white/80 mb-1.5 block">Contact Name *</Label>
                    <Input
                      id="contactName"
                      data-testid="input-contact-name"
                      className={inputClass}
                      placeholder="Your full name"
                      value={data.contactName}
                      onChange={(e) => set("contactName", e.target.value)}
                      onBlur={() => touch("contactName")}
                    />
                    <FieldError msg={getFieldError("contactName")} />
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-white/80 mb-1.5 block">Email Address *</Label>
                    <Input
                      id="email"
                      data-testid="input-email"
                      type="email"
                      className={inputClass}
                      placeholder="you@example.com"
                      value={data.email}
                      onChange={(e) => set("email", e.target.value)}
                      onBlur={() => touch("email")}
                    />
                    <FieldError msg={getFieldError("email")} />
                  </div>
                </div>
              )}

              {/* ── Step 4b: Phone & Instagram ────────────────────────────────── */}
              {step === 3 && subStep === "b" && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-2xl font-black mb-1">Phone & Social</h2>
                    <p className="text-muted-foreground text-sm">How can we contact you and find your event online?</p>
                  </div>

                  <div>
                    <Label htmlFor="phone" className="text-white/80 mb-1.5 block">
                      Phone Number{" "}
                      {data.mode === "Growth" || data.mode === "Custom" ? (
                        <span className="text-white/40 text-xs ml-1">(required)</span>
                      ) : (
                        <span className="text-white/40 text-xs ml-1">(optional)</span>
                      )}
                    </Label>
                    <Input
                      id="phone"
                      data-testid="input-phone"
                      type="tel"
                      className={inputClass}
                      placeholder="(201) 555-0100"
                      value={data.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      onBlur={() => touch("phone")}
                    />
                    <FieldError msg={getFieldError("phone")} />
                  </div>

                  <div>
                    <Label htmlFor="instagramHandle" className="text-white/80 mb-1.5 block">Instagram Handle *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 font-medium">@</span>
                      <Input
                        id="instagramHandle"
                        data-testid="input-instagram-handle"
                        className={`${inputClass} pl-8`}
                        placeholder="yourevent"
                        value={data.instagramHandle.replace(/^@/, "")}
                        onChange={(e) => set("instagramHandle", e.target.value.replace(/^@/, ""))}
                        onBlur={() => touch("instagramHandle")}
                      />
                    </div>
                    <FieldError msg={getFieldError("instagramHandle")} />
                  </div>
                </div>
              )}

              {/* ── Step 5: Terms ─────────────────────────────────────────────── */}
              {step === 4 && (
                <div>
                  <h2 className="text-2xl font-black mb-1">Terms & Conditions</h2>
                  <p className="text-muted-foreground text-sm mb-4">Please read and agree before continuing.</p>

                  <div className="max-h-96 overflow-y-auto border border-white/10 rounded-xl p-5 space-y-5 mb-5 bg-black/20 text-sm">
                    {TERMS_SECTIONS.map(({ heading, body }) => (
                      <div key={heading}>
                        <h4 className="font-bold text-white mb-1">{heading}</h4>
                        <p className="text-white/60 leading-relaxed">{body}</p>
                      </div>
                    ))}
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer group" htmlFor="terms-checkbox">
                    <Checkbox
                      id="terms-checkbox"
                      data-testid="checkbox-terms"
                      checked={data.agreedToTerms}
                      onCheckedChange={(checked) => { set("agreedToTerms", !!checked); touch("agreedToTerms"); }}
                      className="mt-0.5 border-white/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <span className="text-sm text-white/80 group-hover:text-white transition-colors">
                      I have read and agree to the Terms & Conditions
                    </span>
                  </label>
                  <FieldError msg={getFieldError("agreedToTerms")} />
                </div>
              )}

              {/* ── Step 6: Payment ───────────────────────────────────────────── */}
              {step === 5 && (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <h2 className="text-2xl font-black">Complete Your Booking</h2>
                    {saveStatus === "saving" && (
                      <span className="flex items-center gap-1.5 text-xs text-white/50">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
                      </span>
                    )}
                    {saveStatus === "saved" && (
                      <span className="flex items-center gap-1.5 text-xs text-green-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Booking saved
                      </span>
                    )}
                    {saveStatus === "error" && (
                      <span className="text-xs text-red-400">Save failed — see email below</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Summary */}
                    <div className="bg-black/30 border border-white/10 rounded-2xl p-5 space-y-3 text-sm">
                      <h3 className="font-bold text-white/80 uppercase tracking-wider text-xs mb-2">Booking Summary</h3>
                      <Row label="Package" value={`${data.mode} — ${data.budgetRange}`} />
                      <Row label="Event" value={data.eventName} />
                      <Row label="Type" value={data.eventType === "Other" ? data.eventTypeOther : data.eventType} />
                      <Row label="Date" value={data.eventDate} />
                      <Row label="Time" value={data.eventTime} />
                      <Row label="Venue" value={`${data.venueName}, ${data.city}`} />
                      <Row label="Region" value={data.region} />
                      <div className="border-t border-white/10 pt-3">
                        <Row label="Contact" value={data.contactName} />
                        <Row label="Email" value={data.email} />
                        {data.phone && <Row label="Phone" value={data.phone} />}
                        <Row label="Instagram" value={`@${data.instagramHandle}`} />
                      </div>
                    </div>

                    {/* Payment */}
                    <div className="flex flex-col gap-4">
                      <div className="bg-black/30 border border-white/10 rounded-2xl p-5">
                        <h3 className="font-bold text-white/80 uppercase tracking-wider text-xs mb-3">Complete Your Booking</h3>
                        <p className="text-3xl font-black text-primary mb-1">{data.budgetRange}</p>
                        <p className="text-xs text-white/50 mb-4">{data.mode} package</p>
                        {data.mode === "Basic" ? (
                          <p className="text-sm text-white/70">
                            No payment is required for this Basic calendar listing. We will review your submission and confirm shortly.
                          </p>
                        ) : (
                          <>
                            <a
                              href="https://cash.app/$centralgroupevents"
                              target="_blank"
                              rel="noopener noreferrer"
                              data-testid="button-pay-now"
                              className="block w-full text-center bg-[#00D632] hover:bg-[#00D632]/90 text-black font-bold text-lg py-4 rounded-xl transition-colors mb-4"
                            >
                              Pay Now via CashApp
                            </a>

                            <ol className="space-y-2 text-xs text-white/50 list-decimal list-inside">
                              <li>Tap "Pay Now" to open CashApp</li>
                              <li>Send {data.budgetRange} to <span className="text-white/70">$centralgroupevents</span></li>
                              <li>Add your event name in the note field</li>
                              <li>We'll confirm your booking within 24 hours</li>
                            </ol>
                          </>
                        )}
                      </div>

                      {data.mode === "Basic" ? (
                        <div className="rounded-3xl border border-yellow-400/30 bg-yellow-400/10 p-5 text-sm text-white">
                          <p className="font-bold text-yellow-200 mb-2">Want extra reach next time?</p>
                          <p className="text-white/80 mb-3">
                            Upgrade to a paid promotion for premium exposure, priority scheduling, and deeper event distribution.
                          </p>
                          <ul className="list-disc list-inside space-y-2 text-xs text-white/75">
                            <li>Priority event placement across our calendar and newsletter</li>
                            <li>Instagram reels, targeted social promotion, and ads</li>
                            <li>SMS blasts to engaged subscribers</li>
                            <li>Faster confirmation and campaign support</li>
                          </ul>
                        </div>
                      ) : (
                        <a
                          href="https://calendly.com/centralgroupevents/30min"
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="button-calendly"
                          className="block w-full text-center bg-primary hover:bg-primary/90 text-white font-bold text-sm py-3.5 rounded-xl transition-colors"
                        >
                          Book a Strategy Call
                        </a>
                      )}

                      {(data.mode === "Growth" || data.mode === "Custom") && (
                        <p className="text-xs text-white/40 text-center">
                          {data.mode === "Custom"
                            ? "Your Custom package includes a strategy call. Book it above after paying."
                            : "Your Growth package includes priority placement. Use the strategy call to discuss your goals."}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation buttons */}
          {step < 5 && (
            <div className={`px-6 md:px-10 pb-8 flex ${step === 0 ? "justify-end" : "justify-between"} gap-4`}>
              {step > 0 && (
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  data-testid="button-back-step"
                  className="text-white/60 hover:text-white hover:bg-white/5"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              )}
              <Button
                onClick={validateAndNext}
                disabled={!currentStepValid}
                data-testid="button-next-step"
                className="bg-primary hover:bg-primary/90 text-white font-semibold px-8 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {step === 4 ? "Proceed to Payment" : "Next"}
                {step < 4 && <ChevronRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          )}

          {step === 5 && (
            <div className="px-6 md:px-10 pb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => retreat()}
                data-testid="button-back-step"
                className="text-white/60 hover:text-white hover:bg-white/5 order-last sm:order-first"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Button
                onClick={() => navigate("/booking-confirmation")}
                disabled={saveStatus === "saving"}
                data-testid="button-view-confirmation"
                className="bg-primary hover:bg-primary/90 text-white font-semibold px-8 rounded-xl w-full sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saveStatus === "saving" ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                ) : <>Done — View Confirmation <ChevronRight className="w-4 h-4 ml-1" /></>}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Summary row helper ───────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-2">
      <span className="text-white/40 shrink-0">{label}</span>
      <span className="text-white text-right truncate">{value}</span>
    </div>
  );
}
