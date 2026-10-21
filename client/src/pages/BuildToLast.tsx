import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Loader2 } from "lucide-react";
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

export default function BuildToLast() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [workingOnNow, setWorkingOnNow] = useState("");
  const [keyQuestion, setKeyQuestion] = useState("");
  const [contactOptin, setContactOptin] = useState<"" | "yes" | "no">("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim() || !workingOnNow.trim() || !keyQuestion.trim()) {
      setError("Please fill in every required field.");
      return;
    }
    if (!contactOptin) {
      setError("Let us know about the attendee contact sheet (yes or no).");
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
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role: "",
          companyOrHandle: null,
          workingOnNow: workingOnNow.trim(),
          keyQuestion: keyQuestion.trim(),
          topicInterests: [],
          contactSheetOptin: contactOptin === "yes",
          attendeeSource: src || "direct",
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
        description="An intimate convening for the people quietly building the next decade of Newark's creative economy. Thursday, November 12, 2026. Free, RSVP required."
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
            An intimate convening for the people quietly building the next decade of Newark's creative economy.
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
            Newark has the talent. What it doesn't have — reliably — is the business architecture around
            that talent. The contracts that protect you, the funding you don't know how to access, the
            venue economics nobody explains, the real read on where this city is actually heading.
          </p>
          <p style={{ fontSize: 16, color: CREAM_DIM, lineHeight: 1.7, margin: "22px 0 0" }}>
            Four conversations, one room, intentionally small. Open bar · small bites · programming +
            networking. Free, RSVP required.
          </p>
        </section>

        {/* What to Expect */}
        <section style={{ padding: "52px 0", borderBottom: `1px solid ${LINE}` }}>
          <SectionTitle>What to Expect</SectionTitle>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 16, lineHeight: 1.7, color: CREAM_DIM }}>
            {[
              ["Four conversation stations", "legal protection, grants & funding, venue economics, and where Newark is heading — you rotate through all four."],
              ["Built around your questions", "every station is briefed on what the room actually asked at RSVP."],
              ["An elevated atmosphere", "open bar, small bites, and a room curated on purpose."],
              ["Organic networking", "with founders, operators, planners, DJs, and venue owners who are actually building."],
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
              "Something concrete — a contact, an answer, a lead, or a decision you've been circling",
              "A printed guest book of everyone in the room and what they're building",
              "The attendee contact sheet within 48 hours (opt-in)",
              "Edited photos and a recap video within 48 hours, yours to post",
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
            <p style={{ margin: 0 }}><strong style={{ color: CREAM }}>6:00 PM</strong> — Doors, welcome mixer & open bar</p>
            <p style={{ margin: 0 }}><strong style={{ color: CREAM }}>6:45 PM</strong> — Conversation stations begin</p>
            <p style={{ margin: 0 }}><strong style={{ color: CREAM }}>8:00 PM</strong> — Closing mixer & introductions</p>
            <p style={{ margin: 0 }}><strong style={{ color: CREAM }}>8:30 PM</strong> — Night ends</p>
          </div>
          <p style={{ margin: "26px 0 0", fontSize: 15, color: CREAM_DIM }}>
            <span style={{ color: GOLD, letterSpacing: 1.5, textTransform: "uppercase", fontSize: 12 }}>Dress code</span>
            <br />Come as yourself, elevated. · Equal Space, Newark
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
              <Field label="Name *">
                <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-btl-name" />
              </Field>
              <Field label="Email *">
                <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-btl-email" />
              </Field>
              <Field
                label="One line on who you are and what you're working on right now *"
                helper={`This appears in the printed guest book handed to every attendee. Write it as you'd want others to read it. ${workingOnNow.length}/140`}
              >
                <textarea
                  style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                  maxLength={140}
                  value={workingOnNow}
                  onChange={(e) => setWorkingOnNow(e.target.value)}
                  required
                  data-testid="input-btl-working-on"
                />
              </Field>
              <Field
                label="What's the one question you most want answered at Build to Last? *"
                helper="Something you've been trying to figure out, something you'd pay to ask an expert, or something that's been in your head about your next move. Your answers shape what the speakers cover."
              >
                <textarea
                  style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
                  value={keyQuestion}
                  onChange={(e) => setKeyQuestion(e.target.value)}
                  required
                  data-testid="input-btl-question"
                />
              </Field>
              <Field label="Opt in to the attendee contact sheet shared 48 hours after the event? *">
                <div style={{ display: "flex", gap: 26 }}>
                  {(["yes", "no"] as const).map((v) => (
                    <label key={v} style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", fontSize: 16, color: contactOptin === v ? CREAM : CREAM_DIM }}>
                      <input
                        type="radio"
                        name="contactOptin"
                        checked={contactOptin === v}
                        onChange={() => setContactOptin(v)}
                        style={{ accentColor: GOLD, width: 16, height: 16 }}
                        data-testid={`radio-btl-optin-${v}`}
                      />
                      {v === "yes" ? "Yes" : "No"}
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
