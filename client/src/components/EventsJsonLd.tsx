import { Helmet } from "react-helmet-async";
import { useEvents } from "@/hooks/use-landing";

const SITE = "https://www.centralgroupevents.com";

interface Props {
  /** Cap the number of events emitted. Defaults to no cap. */
  maxItems?: number;
  /** Region filter passed to useEvents. */
  region?: string;
}

// Emits one Event JSON-LD per upcoming event so Google can show them in its
// dedicated event search experience and AI engines can answer "what's
// happening in NJ this weekend" with structured data.
export function EventsJsonLd({ maxItems, region }: Props) {
  const { data: events } = useEvents(region);

  if (!events || events.length === 0) return null;

  const items = (maxItems ? events.slice(0, maxItems) : events).filter(
    (e): e is typeof e & { id: number; date: string } => !!e.id && !!e.date,
  );

  if (items.length === 0) return null;

  return (
    <Helmet>
      {items.map((e) => {
        const locationLabel = e.venue || e.city || e.region;
        const schema = {
          "@context": "https://schema.org",
          "@type": "Event",
          "name": e.title,
          "startDate": e.date,
          "eventStatus": "https://schema.org/EventScheduled",
          "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
          "location": {
            "@type": "Place",
            "name": locationLabel,
            "address": {
              "@type": "PostalAddress",
              "addressLocality": e.city || e.region,
              "addressRegion": "NJ",
              "addressCountry": "US",
            },
          },
          "organizer": { "@type": "Organization", "name": "Central Group Events", "url": SITE },
          "image": e.imageUrl || undefined,
          "description": e.description || `${e.title} — ${e.region} event`,
          "url": `${SITE}/?event=${e.id}`,
          ...(e.ticketLink ? {
            offers: {
              "@type": "Offer",
              url: e.ticketLink,
              availability: "https://schema.org/InStock",
            },
          } : {}),
          ...(e.genre ? { keywords: e.genre } : {}),
        };
        return (
          <script key={e.id} type="application/ld+json">{JSON.stringify(schema)}</script>
        );
      })}
    </Helmet>
  );
}
