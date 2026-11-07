import { CalendarDays, MapPin, ArrowUpRight } from "lucide-react";
import type { AssistantEvent } from "@shared/assistant";

function safeTicket(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function instagramProfile(value: string | null) {
  if (!value) return null;
  let handle = value.trim().replace(/^@/, "");
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (!["instagram.com", "www.instagram.com"].includes(url.hostname)) return null;
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length !== 1) return null;
      handle = parts[0];
    } catch { return null; }
  }
  return /^[a-zA-Z0-9_.]{1,30}$/.test(handle) && !["p", "reel", "reels", "stories", "explore"].includes(handle.toLowerCase())
    ? `https://www.instagram.com/${handle}/` : null;
}

export function AssistantEventCard({ event, onTicketClick }: { event: AssistantEvent; onTicketClick: () => void }) {
  const ticket = safeTicket(event.ticketLink);
  const link = ticket || instagramProfile(event.instagramHandle);
  const date = new Date(`${event.date.slice(0, 10)}T12:00:00`);
  const day = Number.isNaN(date.getTime()) ? event.date : date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const timeMatch = event.eventTime?.match(/^(\d{2}):(\d{2})/);
  const hour = timeMatch ? Number(timeMatch[1]) : 0;
  const time = timeMatch ? `${hour % 12 || 12}:${timeMatch[2]} ${hour >= 12 ? "PM" : "AM"} ET` : event.eventTime || "Time TBA";
  const image = (() => {
    try { const url = new URL(event.imageUrl); return ["http:", "https:"].includes(url.protocol) ? url.href : "/images/event-placeholder.svg"; }
    catch { return "/images/event-placeholder.svg"; }
  })();
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-secondary/25 cge-assistant-enter">
      <div className="relative aspect-[16/10] overflow-hidden bg-secondary">
        <img src={image} alt={`${event.title} flyer`} loading="lazy" className="h-full w-full object-cover" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = "/images/event-placeholder.svg"; }} />
        <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-background/90 px-3 py-1 text-xs font-semibold">{event.region}</span>
      </div>
      <div className="flex flex-col gap-3 p-5">
        {event.genre && <p className="text-xs font-semibold uppercase tracking-wider text-accent">{event.genre}</p>}
        <h3 className="text-xl leading-tight">{event.title}</h3>
        <p className="flex gap-2 text-sm text-muted-foreground"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" /><span>{day}<br />{time}</span></p>
        <p className="flex gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span>{[event.venue, event.city].filter(Boolean).join(" · ") || "Venue TBA"}</span></p>
        {link && <a href={link} target="_blank" rel="noopener noreferrer" onClick={ticket ? onTicketClick : undefined} aria-label={`${ticket ? "Get tickets" : "Learn more"} for ${event.title} (opens in a new tab)`} className="mt-2 inline-flex min-h-11 items-center justify-between rounded-xl bg-accent px-4 py-3 text-sm font-bold text-accent-foreground hover:bg-accent/90">{ticket ? "Get tickets" : "Learn more"}<ArrowUpRight className="h-4 w-4" /></a>}
      </div>
    </article>
  );
}
