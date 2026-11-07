import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ArrowRight, Search, Plus, RotateCcw, X } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useEventAssistant } from "@/hooks/use-event-assistant";
import { AssistantEventCard } from "./AssistantEventCard";
import { AssistantSubmissionForm } from "./AssistantSubmissionForm";
import "./event-assistant.css";

const placeholders = ["What’s the word this weekend?", "Find something to do in NJ", "Drop your event and let the people know"];

export default function EventAssistant() {
  const { messages, loading, error, sessionWarning, sendMessage, submitEvent, clearMessages } = useEventAssistant();
  const [input, setInput] = useState("");
  const [placeholder, setPlaceholder] = useState(0);
  const [mode, setMode] = useState<"find" | "submit">("find");
  const [fixed, setFixed] = useState(false);
  const [navHeight, setNavHeight] = useState(80);
  const [nudge, setNudge] = useState(false);
  const [focused, setFocused] = useState(false);
  const slot = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestBusy = useRef(false);
  const mounted = useRef(true);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (timer.current) clearTimeout(timer.current); };
  }, []);
  useEffect(() => {
    if (reducedMotion || focused || input) return;
    const interval = window.setInterval(() => setPlaceholder(p => (p + 1) % placeholders.length), 4200);
    return () => window.clearInterval(interval);
  }, [reducedMotion, focused, input]);
  useEffect(() => {
    const nav = document.querySelector("header");
    let frame = 0;
    const update = () => {
      const height = nav?.getBoundingClientRect().height || 80;
      setNavHeight(height);
      const top = slot.current?.getBoundingClientRect().top;
      setFixed(top !== undefined && top <= height);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    if (nav) observer.observe(nav);
    if (slot.current) observer.observe(slot.current);
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, []);

  function revealResults() {
    requestAnimationFrame(() => {
      if (!results.current) return;
      const top = results.current.getBoundingClientRect().top + window.scrollY - navHeight - 96;
      window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion ? "instant" : "smooth" });
    });
  }

  async function search(raw: string) {
    if (!raw.trim() || loading || requestBusy.current) return;
    setMode("find");
    requestBusy.current = true;
    revealResults();
    try {
      const success = await sendMessage(raw);
      if (mounted.current && success) setInput(current => current === raw ? "" : current);
    } finally { requestBusy.current = false; }
  }
  function onSubmit(event: FormEvent) { event.preventDefault(); void search(input); }
  function openSubmission() { setMode("submit"); revealResults(); }
  function ticketNudge() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (mounted.current) setNudge(true); }, 3000);
  }

  return (
    <div className="cge-assistant relative" style={{ "--assistant-nav-height": `${navHeight}px` } as CSSProperties}>
      <section aria-labelledby="cge-assistant-title" className="relative px-4 pb-9 pt-32 sm:px-6 md:pb-12 md:pt-40">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-full border-b border-white/5 bg-gradient-to-b from-primary/10 via-background to-background" />
        <div className="relative mx-auto max-w-4xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold">
            <p className="flex items-center gap-2 uppercase tracking-[.16em] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-accent" />North · Central · South NJ</p>
            <a href="#pricing" className="inline-flex min-h-10 items-center gap-2 text-accent underline-offset-4 hover:underline">Promote Your Event<ArrowRight className="h-3.5 w-3.5" /></a>
          </div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[.22em] text-accent">The CGE Assistant / Your inside line</p>
          <h1 id="cge-assistant-title" className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tighter sm:text-6xl md:text-7xl">Things to do in NJ.<br /><span className="text-accent">This weekend. Tonight.</span></h1>
          <p className="mb-8 mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">Tell us your city, your music, your kind of night. Let’s find you a plan worth leaving the group chat for.</p>
          <div ref={slot} className="h-[88px] sm:h-[100px]">
            <div className={fixed ? "fixed inset-x-0 z-40 border-b border-white/10 bg-background/95 px-4 py-3 shadow-xl backdrop-blur-xl sm:px-6" : "relative"} style={fixed ? { top: navHeight } : undefined}>
              <form role="search" aria-label="Find New Jersey events with CGE" onSubmit={onSubmit} className={`mx-auto flex max-w-4xl items-center gap-2 border border-accent/35 bg-secondary/40 p-2 focus-within:border-accent ${fixed ? "rounded-xl" : "rounded-2xl sm:p-3"}`}>
                <Search aria-hidden="true" className="ml-2 hidden h-5 w-5 shrink-0 text-accent sm:block" />
                <label htmlFor="cge-assistant-search" className="sr-only">Ask about New Jersey events</label>
                <input ref={searchInput} id="cge-assistant-search" name="event-query" type="search" value={input} onChange={event => setInput(event.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder={placeholders[placeholder]} maxLength={1000} autoComplete="off" className={`min-w-0 flex-1 rounded-lg border-0 bg-transparent px-2 text-foreground placeholder:text-muted-foreground ${fixed ? "h-10 text-sm" : "h-12 text-sm sm:h-14 sm:text-lg"}`} aria-describedby="cge-assistant-catalog" />
                <button type="submit" disabled={loading || !input.trim()} aria-label={loading ? "Finding events" : "Search events"} className={`flex shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 font-bold text-accent-foreground hover:bg-accent/90 ${fixed ? "h-10" : "h-12 sm:h-14 sm:px-6"}`}><span className="hidden sm:inline">{loading ? "Finding…" : "Let’s go"}</span><ArrowRight className="h-5 w-5" /></button>
              </form>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={loading} aria-pressed={mode === "find"} onClick={() => { setMode("find"); searchInput.current?.focus({ preventScroll: true }); }} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-secondary/40 px-4 text-sm font-semibold hover:border-accent/60"><Search className="h-4 w-4 text-accent" />Find events</button>
            <button type="button" disabled={loading} aria-pressed={mode === "submit"} onClick={openSubmission} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-semibold hover:border-accent/60"><Plus className="h-4 w-4 text-accent" />Submit my event</button>
            <p id="cge-assistant-catalog" className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">Searches the CGE catalog</p>
          </div>
        </div>
      </section>
      <div ref={results} id="cge-assistant-results" className="mx-auto max-w-4xl px-4 sm:px-6" style={{ scrollMarginTop: navHeight + 96 }}>
        {sessionWarning && <p role="status" className="mb-4 rounded-xl border border-accent/20 p-3 text-sm text-muted-foreground">{sessionWarning}</p>}
        {mode === "submit" ? <div className="pb-8"><AssistantSubmissionForm submitEvent={submitEvent} loading={loading} error={error} onClose={() => { setMode("find"); searchInput.current?.focus({ preventScroll: true }); }} /></div> :
          <div aria-label="Assistant conversation" aria-busy={loading}>
            {messages.length > 0 && <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-4"><h2 className="text-lg">Your plans, in the making.</h2><button type="button" disabled={loading} onClick={() => { if (window.confirm("Clear this conversation?")) { clearMessages(); setInput(""); } }} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"><RotateCcw className="h-3.5 w-3.5" />Clear chat</button></div>}
            {messages.map((message, index) => <div key={index} className="mb-6 cge-assistant-enter">
              <p className={`whitespace-pre-wrap text-sm leading-relaxed sm:text-base ${message.role === "user" ? "ml-auto max-w-[90%] rounded-2xl rounded-tr-sm border border-white/10 bg-secondary/60 px-5 py-3" : "max-w-3xl text-foreground"}`}><span className="mb-1 block text-[10px] font-bold uppercase tracking-[.16em] text-accent">{message.role === "user" ? "You" : "CGE Assistant"}</span>{message.content}</p>
              {!!message.events?.length && <div className="mt-5 grid gap-4 md:grid-cols-2">{message.events.map(event => <AssistantEventCard key={event.id} event={event} onTicketClick={ticketNudge} />)}</div>}
              {!!message.suggestedCriteria?.length && <div className="mt-4 flex flex-wrap gap-2" aria-label="Related searches">{message.suggestedCriteria.map(criteria => <button key={criteria} type="button" disabled={loading} onClick={() => { setInput(criteria); void search(criteria); }} className="min-h-10 rounded-full border border-accent/30 px-4 py-2 text-sm text-accent hover:bg-accent/10">{criteria}<span className="sr-only"> — search events</span></button>)}</div>}
            </div>)}
            {loading && <div role="status" className="mb-6 rounded-2xl border border-white/10 bg-secondary/20 p-5"><p className="mb-4 text-sm text-accent">Checking the CGE catalog for your next plan…</p><div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse"><div className="h-3 w-3/4 rounded bg-secondary" /><div className="h-3 w-1/2 rounded bg-secondary" /><div className="h-24 rounded-xl bg-secondary/60" /></div></div>}
            {error && <div role="alert" className="mb-6 rounded-xl border border-red-300/25 p-4"><p className="text-sm text-red-300">{error}</p><p className="mt-1 text-xs text-muted-foreground">Your message is still in the search field.</p><button type="button" disabled={loading || !input.trim()} onClick={() => void search(input)} className="mt-3 min-h-10 rounded-lg border border-white/20 px-4 text-sm font-semibold">Try again</button></div>}
          </div>}
      </div>
      {nudge && <div role="status" className="fixed bottom-4 left-4 right-4 z-40 mx-auto flex max-w-lg items-start gap-3 rounded-xl border border-accent/30 bg-background p-4 shadow-xl cge-assistant-enter"><p className="flex-1 text-sm">Next time just ask the assistant -- it’ll find this for you faster</p><button type="button" onClick={() => setNudge(false)} aria-label="Dismiss assistant tip" className="rounded p-1"><X className="h-4 w-4" /></button></div>}
    </div>
  );
}
