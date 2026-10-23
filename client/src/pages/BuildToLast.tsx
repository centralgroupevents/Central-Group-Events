import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Loader2 } from "lucide-react";
import { BTL_INTEREST_KEYS, BTL_INTEREST_LABELS } from "@shared/schema";
import { SEO } from "@/components/SEO";

// Build to Last Vol. 1 — standalone RSVP page. Deliberately NOT in the CGE
// purple system: near-black + cream + gold, serif display. Personal, spare,
// monument-feel per the dev brief; section anatomy per the Launchpad
// inspiration (What to Expect / You'll Walk Away With / Event Flow / Dress).

const INK = "#0b0a08";
const CREAM = "#f3ecdd";
const CREAM_DIM = "rgba(243,236,221,0.72)";
const GOLD = "#c9a35c";
const LINE = "rgba(243,236,221,0.16)";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(243,236,221,0.06)",
  border: `1px solid ${LINE}`,
  color: CREAM,
  padding: "12px 14px",
  fontSize: 16,
  borderRadius: 2,
  outline: "none",
  fontFamily: "inherit",
};

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <label style={{ display: "block", fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", color: GOLD, marginBottom: 8 }}>
        {label}
      </label>
      {children}
      {helper && <p style={{ margin: "8px 0 0", fontSize: 13, color: CREAM_DIM, lineHeight: 1.55 }}>{helper}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 30, fontWeight: 600, color: GOLD, margin: "0 0 18px", letterSpacing: 0.5 }}>
      ✦ {children}
    </h2>
  );
}

// A personalized link from the thank-you email carries ?e=<base64url email>
// &t=<signature>&n=<name> — then the form skips name/email entirely.
function readIdentityFromUrl(): { e: string; t: string; name: string; email: string } | null {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search);
  const e = p.get("e") || "";
  const t = p.get("t") || "";
  if (!e || !t) return null;
  try {
    const email = atob(e.replace(/-/g, "+").replace(/_/g, "/"));
    if (!email.includes("@")) return null;
    return { e, t, name: p.get("n") || "", email };
  } catch {
    return null;
  }
}

export default function BuildToLast() {
  const [identity] = useState(readIdentityFromUrl);
  const [name, setName] = useState(identity?.name ?? "");
  const [email, setEmail] = useState(identity?.email ?? "");
  const [interests, setInterests] = useState<Set<string>>(new Set());

  function toggleInterest(key: string) {
    const next = new Set(interests);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setInterests(next);
  }
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const effectiveName = name.trim() || (identity ? identity.email.split("@")[0] : "");
    if (!effectiveName || !email.trim()) {
      setError("Please fill in your name and email.");
      return;
    }
    if (interests.size === 0) {
      setError("Pick at least one — it helps us set the room.");
      return;
    }
    setSubmitting(true);
    try {
      const src = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("src") || undefined
        : undefined;
      const res = await fetch("/api/build-to-last/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: effectiveName,
          email: email.trim().toLowerCase(),
          role: "",
          companyOrHandle: null,
          workingOnNow: "",
          keyQuestion: "",
          topicInterests: Array.from(interests),
          contactSheetOptin: false,
          attendeeSource: src || "direct",
          ...(identity ? { e: identity.e, t: identity.t } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "Something went wrong — try again.");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: INK, color: CREAM, fontFamily: "'Archivo', 'Helvetica Neue', Arial, sans-serif" }}>
      <SEO
        title="Build to Last Vol. 1 — Newark"
        description="An invite-only mixer for the planners, venue owners, and creators building across New Jersey. Thursday, November 12, 2026. Free, RSVP required."
        canonical="https://centralgroupevents.com/build-to-last"
      />
      <Helmet>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Archivo:wght@400;600;700&display=swap" />
      </Helmet>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 20px" }}>
        {/* Hero */}
        <header style={{ padding: "88px 0 56px", textAlign: "center", borderBottom: `1px solid ${LINE}` }}>
          <p style={{ letterSpacing: 5, fontSize: 12, color: GOLD, textTransform: "uppercase", margin: "0 0 22px" }}>
            Central Group Events presents
          </p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, fontSize: "clamp(54px, 11vw, 92px)", lineHeight: 0.95, margin: 0, letterSpacing: 1 }}>
            BUILD<br />TO LAST
          </h1>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontStyle: "italic", color: GOLD, margin: "14px 0 30px" }}>
            Vol. 1
          </p>
          <p style={{ fontSize: 15, letterSpacing: 2.5, textTransform: "uppercase", margin: "0 0 10px" }}>
            Thursday, November 12, 2026 · Newark
          </p>
          <p style={{ fontSize: 17, color: CREAM_DIM, maxWidth: 460, margin: "0 auto 36px", lineHeight: 1.65 }}>
            An invite-only mixer for the planners, venue owners, and creators building across New Jersey.
          </p>
          <a
            href="#rsvp"
            style={{ display: "inline-block", background: GOLD, color: INK, padding: "14px 44px", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", fontSize: 14, textDecoration: "none", borderRadius: 2 }}
            data-testid="button-hero-rsvp"
          >
            RSVP
          </a>
        </header>

        {/* Premise */}
        <section style={{ padding: "52px 0", borderBottom: `1px solid ${LINE}` }}>
          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 23, lineHeight: 1.65, margin: 0 }}>
            Promoting events across New Jersey, we've come across so many influential, hardworking
            people who chose to curate spaces and places here — and who believe this state is only
            going to present more opportunities for people like us.
          </p>
          <p style={{ fontSize: 16, color: CREAM_DIM, lineHeight: 1.7, margin: "22px 0 0" }}>
            The best habit any of us can keep is an informed, active network that learns from one
            another. Build to Last is that habit, in person — one room, an intentionally set crowd.
          </p>
        </section>

        {/* What to Expect */}
        <section style={{ padding: "52px 0", borderBottom: `1px solid ${LINE}` }}>
          <SectionTitle>What to Expect</SectionTitle>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 16, lineHeight: 1.7, color: CREAM_DIM }}>
            {[
              ["An intentionally set crowd", "planners, venue owners, and creators from across the state."],
              ["Moderated conversations", "on event planning, spaces, and brand building in New Jersey."],
              ["Organic networking", "with people building the same things you are."],
              ["A professionally photographed night", "you'll get the photos after."],
            ].map(([bold, rest], i) => (
              <li key={i} style={{ margin: "0 0 14px", paddingLeft: 26, position: "relative" }}>
                <span style={{ position: "absolute", left: 0, color: GOLD }}>✓</span>
                <strong style={{ color: CREAM }}>{bold}</strong> — {rest}
              </li>
            ))}
          </ul>
        </section>

        {/* You'll Walk Away With */}
        <section style={{ padding: "52px 0", borderBottom: `1px solid ${LINE}` }}>
          <SectionTitle>You'll Walk Away With</SectionTitle>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 16, lineHeight: 1.7, color: CREAM_DIM }}>
            {[
              "Relationships worth keeping — people you'll actually hear from again",
              "A sharper sense of where New Jersey is heading, from the people building it",
              "Perspectives you didn't walk in with",
            ].map((item, i) => (
              <li key={i} style={{ margin: "0 0 14px", paddingLeft: 26, position: "relative" }}>
                <span style={{ position: "absolute", left: 0, color: GOLD }}>✓</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* The Essentials */}
        <section style={{ padding: "52px 0", borderBottom: `1px solid ${LINE}` }}>
          <SectionTitle>The Essentials</SectionTitle>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 16, lineHeight: 1.7, color: CREAM_DIM }}>
            {[
              "Open bar",
              "Small bites",
              "Programming + networking",
              "Free · RSVP required",
            ].map((item, i) => (
              <li key={i} style={{ margin: "0 0 14px", paddingLeft: 26, position: "relative" }}>
                <span style={{ position: "absolute", left: 0, color: GOLD }}>✓</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Event Flow + Dress code */}
        <section style={{ padding: "52px 0", borderBottom: `1px solid ${LINE}` }}>
          <SectionTitle>Event Flow</SectionTitle>
          <div style={{ fontSize: 16, lineHeight: 2, color: CREAM_DIM }}>
            <p style={{ margin: 0 }}><strong style={{ color: CREAM }}>6:00 PM</strong> — Doors open. Introductions and open bar.</p>
            <p style={{ margin: 0 }}><strong style={{ color: CREAM }}>7:00 PM</strong> — Moderated conversations centered around event planning, spaces, and brand building in NJ</p>
            <p style={{ margin: 0 }}><strong style={{ color: CREAM }}>8:30 PM</strong> — Night cap</p>
          </div>
          <p style={{ margin: "26px 0 0", fontSize: 15, color: CREAM_DIM }}>
            <span style={{ color: GOLD, letterSpacing: 1.5, textTransform: "uppercase", fontSize: 12 }}>Dress code</span>
            <br />Come as yourself — we know plenty of you are coming straight from work. Business casual is perfect. · Equal Space, Newark
          </p>
        </section>

        {/* RSVP form */}
        <section id="rsvp" style={{ padding: "56px 0 96px" }}>
          <SectionTitle>RSVP</SectionTitle>
          {submitted ? (
            <div style={{ border: `1px solid ${GOLD}`, padding: "36px 28px", textAlign: "center" }} data-testid="text-btl-success">
              <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, margin: "0 0 10px" }}>You're in.</p>
              <p style={{ color: CREAM_DIM, margin: 0, fontSize: 16 }}>Check your email for confirmation. — Anthony</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {identity ? (
                <p style={{ fontSize: 14, color: GOLD, margin: "0 0 22px", letterSpacing: 0.5 }} data-testid="text-btl-identity">
                  RSVP'ing as {identity.name || identity.email} — one tap below and you're in.
                </p>
              ) : (
                <>
                  <Field label="Name *">
                    <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-btl-name" />
                  </Field>
                  <Field label="Email *">
                    <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-btl-email" />
                  </Field>
                </>
              )}
              <Field
                label="What are you most looking to walk away with? *"
                helper="Pick as many as apply — it helps us set the room and the conversations."
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {BTL_INTEREST_KEYS.map((key) => (
                    <label key={key} style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer", fontSize: 16, color: interests.has(key) ? CREAM : CREAM_DIM }}>
                      <input
                        type="checkbox"
                        checked={interests.has(key)}
                        onChange={() => toggleInterest(key)}
                        style={{ marginTop: 4, accentColor: GOLD, width: 16, height: 16 }}
                        data-testid={`checkbox-btl-interest-${key}`}
                      />
                      {BTL_INTEREST_LABELS[key]}
                    </label>
                  ))}
                </div>
              </Field>

              {error && <p style={{ color: "#e08a7a", fontSize: 15, margin: "0 0 18px" }} data-testid="text-btl-error">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                style={{ width: "100%", background: GOLD, color: INK, border: 0, padding: "16px 0", fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", fontSize: 15, cursor: submitting ? "wait" : "pointer", borderRadius: 2, fontFamily: "inherit" }}
                data-testid="button-btl-submit"
              >
                {submitting ? <Loader2 style={{ width: 18, height: 18, display: "inline", verticalAlign: "-3px" }} className="animate-spin" /> : "RSVP"}
              </button>
              <p style={{ margin: "16px 0 0", fontSize: 12, color: "rgba(243,236,221,0.45)", textAlign: "center", lineHeight: 1.6 }}>
                Free · RSVP required · You'll get event updates by email from Anthony; every email has a one-click unsubscribe.
              </p>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
