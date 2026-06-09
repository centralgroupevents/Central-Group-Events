// Shared SEO topic configuration for programmatic landing pages.
//
// Both the client (TopicLanding.tsx) and server (seo.ts, routes.ts sitemap) import
// from this file. Adding a new topic here automatically:
//   - Creates a server-side meta + JSON-LD entry for the URL
//   - Adds the URL to /sitemap.xml
//   - Activates the client-side route via TopicLanding
//
// Categories of pages:
//   - city: /things-to-do-in-<citySlug>
//   - type: /<typeSlug>-in-nj
//   - city-type combo: /<typeSlug>-in-<citySlug>
//   - time-modified: /things-to-do-in-nj-<time>
//   - tentpole: hand-crafted unique content (e.g. World Cup hub)

export interface TopicConfig {
  slug: string;
  pageType: "city" | "type" | "city-type" | "time" | "tentpole";
  h1: string;
  metaTitle: string;
  metaDescription: string;
  filter: {
    city?: string;
    genre?: string[];
    days?: string[];
  };
  introParagraphs: string[];
  faqItems?: { q: string; a: string }[];
  /** Cities the page strongly relates to, used for cross-linking */
  relatedCities?: string[];
  /** Event types the page strongly relates to, used for cross-linking */
  relatedTypes?: string[];
  /**
   * Tier 1 topics (always index). Tier 2 topics auto-noindex when fewer than 3
   * events match that week — they re-index automatically when events fill in.
   */
  alwaysIndex?: boolean;
}

// Cities that should always be indexed (regardless of weekly event count).
// Every city with a hand-written customIntro belongs here — otherwise the
// editorial intro is invisible to Google during sparse weeks.
const TIER_1_CITY_SLUGS = new Set([
  // Original Tier 1
  "newark", "jersey-city", "hoboken", "trenton", "atlantic-city", "east-rutherford",
  // Cities added with editorial intros (PR 19)
  "asbury-park", "morristown", "princeton", "red-bank", "long-branch",
  "wildwood", "cape-may", "ocean-city", "holmdel", "sayreville",
  "belmar", "seaside-heights", "point-pleasant-beach",
]);

interface CityProfile {
  slug: string;
  name: string;
  region: "North NJ" | "Central NJ" | "South NJ";
  customIntro?: string;
}

interface TypeProfile {
  slug: string;
  label: string;
  /** Genre/eventType values from events table that match this type (case-insensitive) */
  genreMatches: string[];
}

const NJ_CITIES: CityProfile[] = [
  { slug: "newark", name: "Newark", region: "North NJ",
    customIntro: "Newark is the cultural heartbeat of North Jersey — home to NJPAC, Prudential Center concerts, downtown lounges, Ironbound restaurants, and the most active nightlife calendar in the state. Whether you're looking for a Friday R&B night, a Sunday cookout, or a film screening at Express Newark, the city's weekly event roster is one of the densest in the tri-state area." },
  { slug: "jersey-city", name: "Jersey City", region: "North NJ",
    customIntro: "Jersey City packs Manhattan-skyline views, a fast-growing arts district around Mana Contemporary, waterfront brunches, and one of the most diverse weekly event scenes in the state. From Grove Street rooftop parties to KO Cafe networking workshops, there's always something happening." },
  { slug: "hoboken", name: "Hoboken", region: "North NJ",
    customIntro: "Hoboken's mile-square density puts more bars, brunches, and live music per block than anywhere else in NJ. The Washington Street corridor anchors a packed weekend nightlife scene, with rooftops and waterfront events along Sinatra Drive." },
  { slug: "paterson", name: "Paterson", region: "North NJ" },
  { slug: "elizabeth", name: "Elizabeth", region: "North NJ" },
  { slug: "trenton", name: "Trenton", region: "Central NJ",
    customIntro: "Trenton is Central NJ's creative hub — open-mic nights at WordAlive, brunches at Cooper's Riverview, gallery openings at Artworks Trenton, and a thriving Mill Hill historic district. The capital's event calendar leans into poetry, jazz, and community-driven happenings." },
  { slug: "new-brunswick", name: "New Brunswick", region: "Central NJ",
    customIntro: "Anchored by Rutgers University, New Brunswick balances a college-town energy with serious cultural programming — George Street Playhouse, State Theatre concerts, late-night spots along Easton Avenue, and brunches at Delta's." },
  { slug: "edison", name: "Edison", region: "Central NJ" },
  { slug: "atlantic-city", name: "Atlantic City", region: "South NJ",
    customIntro: "Atlantic City is the South Jersey nightlife capital — Borgata Music Box concerts, The Pool After Dark at Harrah's, boardwalk events, and silent parties at venues like The Royce Social Hall. Beach, casino, and party scenes layered onto one calendar." },
  { slug: "cherry-hill", name: "Cherry Hill", region: "South NJ" },
  { slug: "camden", name: "Camden", region: "South NJ" },
  { slug: "montclair", name: "Montclair", region: "North NJ",
    customIntro: "Montclair is one of NJ's most established arts towns — Wellmont Theater concerts, indie galleries, the Montclair Film Festival, and a Bloomfield Avenue restaurant row that doubles as an event corridor on weekends." },
  { slug: "bloomfield", name: "Bloomfield", region: "North NJ" },
  { slug: "plainfield", name: "Plainfield", region: "Central NJ" },
  { slug: "westfield", name: "Westfield", region: "Central NJ" },
  { slug: "englewood", name: "Englewood", region: "North NJ" },
  { slug: "hamilton", name: "Hamilton", region: "Central NJ" },
  { slug: "iselin", name: "Iselin", region: "Central NJ" },
  { slug: "linden", name: "Linden", region: "Central NJ" },
  { slug: "madison", name: "Madison", region: "North NJ" },
  { slug: "passaic", name: "Passaic", region: "North NJ" },
  { slug: "roselle-park", name: "Roselle Park", region: "Central NJ" },
  { slug: "somerville", name: "Somerville", region: "Central NJ" },
  { slug: "west-orange", name: "West Orange", region: "North NJ" },
  { slug: "edgewater", name: "Edgewater", region: "North NJ" },
  { slug: "east-rutherford", name: "East Rutherford", region: "North NJ",
    customIntro: "East Rutherford is home to MetLife Stadium — concert venue, NFL stadium, and host of the 2026 FIFA World Cup Final. Events around the stadium and American Dream complex make this one of the most-visited destinations in North Jersey on game and concert days." },
  { slug: "asbury-park", name: "Asbury Park", region: "Central NJ",
    customIntro: "Asbury Park is New Jersey's iconic music town — the Stone Pony, Wonder Bar, Convention Hall, and the Asbury Hotel rooftop run a packed live-music calendar Memorial Day through Labor Day, with year-round shows downtown and on the boardwalk." },
  { slug: "morristown", name: "Morristown", region: "North NJ",
    customIntro: "Morristown anchors Central-North NJ with the historic Green, Mayo Performing Arts Center (MPAC) concerts, the Mayo Theatre, and a Speedwell Avenue restaurant row that hosts everything from jazz to charity galas." },
  { slug: "princeton", name: "Princeton", region: "Central NJ",
    customIntro: "Princeton blends university energy with one of NJ's strongest cultural calendars — McCarter Theatre concerts and plays, Princeton Garden Theatre indie films, Palmer Square events, Forbes Centre arts, and seasonal festivals." },
  { slug: "red-bank", name: "Red Bank", region: "Central NJ",
    customIntro: "Red Bank is Monmouth County's nightlife capital — Count Basie Center for the Arts concerts, downtown bars and restaurants on Broad Street, Two River Theater performances, and the Red Bank Jazz & Blues Festival." },
  { slug: "long-branch", name: "Long Branch", region: "Central NJ",
    customIntro: "Long Branch's Pier Village brings beach-town summer energy with rooftop bars, oceanfront concerts at the Great Lawn, fireworks every Wednesday in summer, and live events along the boardwalk." },
  { slug: "wildwood", name: "Wildwood", region: "South NJ",
    customIntro: "Wildwood's two-mile boardwalk, the doo-wop motels of the Wildwoods, and Morey's Piers headline a summer event lineup that draws hundreds of thousands — concerts, festivals, fireworks, and beach-bar nights." },
  { slug: "cape-may", name: "Cape May", region: "South NJ",
    customIntro: "Cape May, the Victorian seaside town at the southern tip of NJ, hosts the Cape May Jazz Festival, Wine Festival, and a year-round calendar of music, art, and culinary events at venues like Cape May Stage and the Convention Hall." },
  { slug: "ocean-city", name: "Ocean City", region: "South NJ",
    customIntro: "Ocean City, the family-friendly South Jersey shore town, runs a packed summer events calendar — boardwalk concerts, fireworks, the Night in Venice boat parade, and Music Pier shows." },
  { slug: "holmdel", name: "Holmdel", region: "Central NJ",
    customIntro: "Holmdel is home to PNC Bank Arts Center — one of NJ's biggest outdoor concert venues. Summer brings headliner tours from May through October, with surrounding restaurants and bars filling up on show nights." },
  { slug: "toms-river", name: "Toms River", region: "South NJ" },
  { slug: "hackensack", name: "Hackensack", region: "North NJ" },
  { slug: "fort-lee", name: "Fort Lee", region: "North NJ" },
  { slug: "clifton", name: "Clifton", region: "North NJ" },
  { slug: "bayonne", name: "Bayonne", region: "North NJ" },
  { slug: "east-orange", name: "East Orange", region: "North NJ" },
  { slug: "union-city", name: "Union City", region: "North NJ" },
  { slug: "wayne", name: "Wayne", region: "North NJ" },
  { slug: "summit", name: "Summit", region: "North NJ" },
  { slug: "maplewood", name: "Maplewood", region: "North NJ" },
  { slug: "sayreville", name: "Sayreville", region: "Central NJ",
    customIntro: "Sayreville's Starland Ballroom is one of NJ's most-booked mid-sized rock and metal venues, drawing national acts week in and week out." },
  { slug: "south-plainfield", name: "South Plainfield", region: "Central NJ" },
  { slug: "perth-amboy", name: "Perth Amboy", region: "Central NJ" },
  { slug: "carteret", name: "Carteret", region: "Central NJ" },
  { slug: "woodbridge", name: "Woodbridge", region: "Central NJ" },
  { slug: "belmar", name: "Belmar", region: "Central NJ",
    customIntro: "Belmar is a Jersey Shore nightlife favorite — D'Jais, Salt Creek Grille, and the Belmar Marina anchor a summer scene of day parties, beach concerts, and rooftop bars." },
  { slug: "seaside-heights", name: "Seaside Heights", region: "Central NJ",
    customIntro: "Seaside Heights — the iconic Jersey Shore boardwalk town — runs a packed summer event calendar with Polish-American Festival, fireworks, classic car shows, and beach concerts at venues like Klee's Bar & Grill." },
  { slug: "point-pleasant-beach", name: "Point Pleasant Beach", region: "Central NJ",
    customIntro: "Point Pleasant Beach centers around Jenkinson's boardwalk and aquarium, with summer events including fireworks, sandcastle contests, the BBQ Beer & Boots festival, and live music at venues along the boardwalk." },
  { slug: "pleasantville", name: "Pleasantville", region: "South NJ" },
  { slug: "lakewood", name: "Lakewood", region: "South NJ" },
  { slug: "belleville", name: "Belleville", region: "North NJ" },
];

const EVENT_TYPES: TypeProfile[] = [
  { slug: "brunches",            label: "Brunch",          genreMatches: ["brunch", "food & drink"] },
  { slug: "day-parties",         label: "Day Party",       genreMatches: ["day party"] },
  { slug: "concerts",            label: "Concert",         genreMatches: ["concert", "music"] },
  { slug: "comedy-shows",        label: "Comedy Show",     genreMatches: ["comedy"] },
  { slug: "happy-hours",         label: "Happy Hour",      genreMatches: ["happy hour"] },
  { slug: "live-music",          label: "Live Music",      genreMatches: ["live music", "music"] },
  { slug: "nightlife",           label: "Nightlife",       genreMatches: ["nightlife", "party", "club night"] },
  { slug: "festivals",           label: "Festival",        genreMatches: ["festival", "arts festival"] },
  { slug: "open-mics",           label: "Open Mic",        genreMatches: ["open mic"] },
  { slug: "pop-ups",             label: "Pop-Up",          genreMatches: ["pop-up", "pop up"] },
  { slug: "markets",             label: "Market",          genreMatches: ["market"] },
  { slug: "dance-events",        label: "Dance Event",     genreMatches: ["dance", "dance event"] },
  { slug: "yoga-classes",        label: "Yoga Class",      genreMatches: ["yoga"] },
  { slug: "workshops",           label: "Workshop",        genreMatches: ["workshop"] },
  { slug: "networking-events",   label: "Networking Event", genreMatches: ["networking"] },
  { slug: "film-screenings",     label: "Film Screening",  genreMatches: ["screening", "film", "movie"] },
  { slug: "art-events",          label: "Art Event",       genreMatches: ["art", "artist talk", "art exhibition"] },
  { slug: "parades",             label: "Parade",          genreMatches: ["parade"] },
  { slug: "cookouts",            label: "Cookout",         genreMatches: ["cookout"] },
  { slug: "food-festivals",      label: "Food Festival",   genreMatches: ["food festival", "food & drink"] },
];

const TOP_COMBO_CITIES = [
  "newark", "jersey-city", "hoboken", "trenton", "atlantic-city",
  "montclair", "new-brunswick", "edison", "cherry-hill", "bloomfield",
];

function cityName(slug: string): string {
  return NJ_CITIES.find((c) => c.slug === slug)?.name || slug;
}

function cityFaqs(city: CityProfile): { q: string; a: string }[] {
  return [
    {
      q: `What kinds of events happen in ${city.name}, NJ?`,
      a: `${city.name} hosts a mix of nightlife (clubs, lounges, bars), brunches, day parties, live music, concerts, comedy shows, and community festivals throughout the year. Central Group Events curates a weekly list of the most-attended events in the area.`,
    },
    {
      q: `When is the best time to go out in ${city.name}?`,
      a: `Friday and Saturday nights are the busiest in ${city.name} — most clubs, lounges, and concerts run after 9 PM. Sundays are popular for brunches and day parties, especially in summer.`,
    },
    {
      q: `Where can I find a weekly schedule of ${city.name} events?`,
      a: `Central Group Events publishes a curated weekly schedule covering ${city.name} and the rest of New Jersey. Visit https://centralgroupevents.com/things-to-do-in-nj or subscribe to the weekly newsletter for the full list.`,
    },
  ];
}

function typeFaqs(type: TypeProfile): { q: string; a: string }[] {
  return [
    {
      q: `Where are the best ${type.label.toLowerCase()} spots in New Jersey?`,
      a: `The best ${type.label.toLowerCase()} events in NJ rotate weekly. Top venues consistently appear in Newark, Jersey City, Hoboken, Trenton, and Atlantic City — Central Group Events tracks them in our weekly curated list.`,
    },
    {
      q: `How often do new ${type.label.toLowerCase()} events get added?`,
      a: `Weekly. Our team verifies and publishes new ${type.label.toLowerCase()} events every week across all three NJ regions (North, Central, South).`,
    },
    {
      q: `Are ${type.label.toLowerCase()} events in NJ usually ticketed?`,
      a: `It varies. Many ${type.label.toLowerCase()} events are free or pay-at-door; others (especially headline concerts and festivals) require advance tickets. Each event's listing on Central Group Events includes a "Learn more" link to the ticket page when applicable.`,
    },
  ];
}

function buildCityTopic(city: CityProfile): TopicConfig {
  const intro = city.customIntro
    ? city.customIntro
    : `${city.name} is one of ${city.region}'s most active event destinations. From brunches and day parties to concerts, comedy shows, and weekly nightlife, the calendar covers nearly every weekend.`;
  return {
    slug: `things-to-do-in-${city.slug}`,
    pageType: "city",
    h1: `Things to Do in ${city.name}, NJ`,
    metaTitle: `Things to Do in ${city.name}, NJ — Events This Week | Central Group Events`,
    metaDescription: `Discover the best things to do in ${city.name}, ${city.region}. Curated weekly events including nightlife, brunches, day parties, concerts, and live music.`,
    filter: { city: city.name },
    introParagraphs: [
      intro,
      `This page is updated weekly with the most-anticipated ${city.name} events. Subscribe to the Central Group Events newsletter to get the full list every Monday morning.`,
    ],
    faqItems: cityFaqs(city),
    relatedTypes: ["brunches", "day-parties", "concerts", "nightlife", "comedy-shows"],
    alwaysIndex: TIER_1_CITY_SLUGS.has(city.slug),
  };
}

function buildTypeTopic(type: TypeProfile): TopicConfig {
  return {
    slug: `${type.slug}-in-nj`,
    pageType: "type",
    h1: `${type.label}s in New Jersey`,
    metaTitle: `${type.label}s in NJ — Weekly ${type.label} Events | Central Group Events`,
    metaDescription: `The best ${type.label.toLowerCase()} events in New Jersey, updated weekly. Covers Newark, Jersey City, Hoboken, Trenton, Atlantic City, and all of NJ.`,
    filter: { genre: type.genreMatches },
    introParagraphs: [
      `Looking for ${type.label.toLowerCase()} events in New Jersey? Central Group Events tracks every notable ${type.label.toLowerCase()} happening across the state — North NJ, Central NJ, and South NJ — and refreshes the list every week.`,
      `Below is this week's lineup. Each event includes venue, city, date/time, and a link to the ticket page or organizer's profile.`,
    ],
    faqItems: typeFaqs(type),
    relatedCities: TOP_COMBO_CITIES,
    alwaysIndex: true,
  };
}

function buildComboTopic(city: CityProfile, type: TypeProfile): TopicConfig {
  return {
    slug: `${type.slug}-in-${city.slug}`,
    pageType: "city-type",
    h1: `${type.label}s in ${city.name}, NJ`,
    metaTitle: `${type.label}s in ${city.name}, NJ — This Week's Events | Central Group Events`,
    metaDescription: `Find ${type.label.toLowerCase()} events in ${city.name}, ${city.region}. Curated weekly by Central Group Events.`,
    filter: { city: city.name, genre: type.genreMatches },
    introParagraphs: [
      `Looking for ${type.label.toLowerCase()} events in ${city.name}? This list is updated weekly with venues across the area.`,
      `Don't see anything that fits this weekend? Check the broader ${city.name} events page or browse all NJ ${type.label.toLowerCase()} events.`,
    ],
    faqItems: [
      {
        q: `Are there ${type.label.toLowerCase()} events in ${city.name} every week?`,
        a: `${city.name} hosts ${type.label.toLowerCase()} events on a regular cadence — usually weekly during peak season. Central Group Events publishes the full schedule each Monday morning.`,
      },
    ],
  };
}

const TIME_TOPICS: TopicConfig[] = [
  {
    slug: "things-to-do-in-nj-this-weekend",
    pageType: "time",
    h1: "Things to Do in NJ This Weekend",
    metaTitle: "Things to Do in NJ This Weekend — Fri, Sat, Sun | Central Group Events",
    metaDescription: "The most-anticipated Friday, Saturday, and Sunday events across New Jersey this weekend. Brunches, day parties, concerts, festivals, and nightlife.",
    filter: { days: ["Fri", "Sat", "Sun"] },
    introParagraphs: [
      "Looking for things to do in NJ this weekend? Here's the curated lineup for the upcoming Friday, Saturday, and Sunday across North, Central, and South New Jersey.",
      "Each event includes venue, city, time, and a link to the organizer. Filter by region or event type using the controls below.",
    ],
    faqItems: [
      { q: "What's happening in NJ this weekend?", a: "Across North NJ, Central NJ, and South NJ, this weekend's lineup typically includes 40-80 curated events — brunches, day parties, concerts, comedy, and nightlife. The list above is updated every Monday morning." },
      { q: "Where do most NJ weekend events take place?", a: "The densest weekend event clusters are in Newark, Jersey City, Hoboken, Atlantic City, and Trenton — but you'll find weekend programming in every county." },
    ],
    alwaysIndex: true,
  },
  {
    slug: "things-to-do-in-nj-tonight",
    pageType: "time",
    h1: "Things to Do in NJ Tonight",
    metaTitle: "Things to Do in NJ Tonight — Live Events Now | Central Group Events",
    metaDescription: "Tonight's NJ event lineup — what's happening across the state right now. Concerts, parties, brunches, and live music.",
    filter: {},
    introParagraphs: [
      "What's happening in New Jersey tonight? Below is the live event lineup pulled from our weekly curated schedule. Filter by region to narrow down to your area.",
      "Most evening events kick off between 7-10 PM. Day parties and brunches typically start between noon and 4 PM.",
    ],
    faqItems: [
      { q: "What's happening in NJ tonight?", a: "On any given weeknight in New Jersey, expect 5-20 events — open mics, happy hours, live music, and special venue nights. Weekends double or triple that." },
    ],
    alwaysIndex: true,
  },
  {
    slug: "free-things-to-do-in-nj",
    pageType: "time",
    h1: "Free Things to Do in NJ",
    metaTitle: "Free Things to Do in NJ — No-Cost Events This Week | Central Group Events",
    metaDescription: "Free events across New Jersey — community festivals, gallery openings, open mics, parades, parks events, and more.",
    filter: {},
    introParagraphs: [
      "Free things to do in NJ this week. The lineup below includes community events, gallery openings, open mics, parades, walks/runs, and other no-cost programming across the state.",
      "Some venues may have optional cover or food/drink minimums — check the event's link for details.",
    ],
    faqItems: [
      { q: "Are there free events in NJ every week?", a: "Yes. Most weeks include 10-30 free community events across NJ — open mics, gallery talks, parades, runs, and family activities." },
    ],
    alwaysIndex: true,
  },
];

const TENTPOLE_TOPICS: TopicConfig[] = [
  {
    slug: "world-cup-2026-nj-guide",
    pageType: "tentpole",
    h1: "What's Happening in NJ During the 2026 World Cup",
    metaTitle: "Things to Do in NJ During the 2026 World Cup | Central Group Events",
    metaDescription: "The full New Jersey event calendar during the 2026 FIFA World Cup (June 11 – July 19). Day parties, brunches, concerts, nightlife, and more across NJ — plus where to watch the matches.",
    filter: {},
    introParagraphs: [
      "The 2026 FIFA World Cup runs June 11 through July 19, 2026, and New Jersey is at the center of it — MetLife Stadium hosts the Final on July 19, along with several earlier tournament matches.",
      "This page is the broader NJ event scene during the tournament window: brunches, day parties, concerts, festivals, and nightlife across the state. Everything below is curated weekly by Central Group Events.",
      "Looking specifically for World Cup watch parties? We track those separately on a dedicated page. Browse approved watch parties at /world-cup-2026-nj-watch-parties — or submit your own venue at /submit-world-cup-watch-party.",
    ],
    faqItems: [
      {
        q: "Where can I find a list of World Cup watch parties in NJ?",
        a: "Central Group Events maintains a dedicated, free public list of approved 2026 World Cup watch parties across New Jersey at https://centralgroupevents.com/world-cup-2026-nj-watch-parties — filterable by tournament week. Venues hosting a watch party can submit it for free at https://centralgroupevents.com/submit-world-cup-watch-party.",
      },
      {
        q: "Where is the World Cup 2026 Final being held?",
        a: "The FIFA World Cup 2026 Final will be played at MetLife Stadium in East Rutherford, New Jersey on July 19, 2026. MetLife also hosts several earlier tournament matches.",
      },
      {
        q: "What other World Cup 2026 matches are at MetLife Stadium?",
        a: "MetLife Stadium is scheduled to host multiple group stage and knockout round matches throughout June and early July 2026, in addition to the July 19 Final. Refer to the official FIFA fixture list for exact dates.",
      },
      {
        q: "What is there to do in NJ during the World Cup?",
        a: "The tournament overlaps with peak NJ summer events — beach weekends in Atlantic City, day parties in Newark and Jersey City, festivals statewide, brunches in Hoboken. The Central Group Events calendar covers all of it; this page lists the upcoming items.",
      },
      {
        q: "How do I get to MetLife Stadium from NYC?",
        a: "MetLife is approximately 10 miles west of Manhattan. Direct options include the NJ Transit Meadowlands Rail Line from Penn Station (event-day service only), the 320/353 NJ Transit buses from Port Authority Bus Terminal, or rideshare/taxi via the Lincoln Tunnel.",
      },
      {
        q: "When is the best time to visit NJ for the World Cup?",
        a: "The tournament runs June 11 – July 19, 2026. NJ-hosted matches concentrate the highest event density, with the Final week (mid-to-late July) being the busiest. Plan accommodations early — hotel inventory near MetLife typically books out months in advance for major events.",
      },
    ],
    relatedCities: ["east-rutherford", "newark", "jersey-city", "hoboken"],
    alwaysIndex: true,
  },
];

const ALL_TOPICS: TopicConfig[] = [
  ...NJ_CITIES.map(buildCityTopic),
  ...EVENT_TYPES.map(buildTypeTopic),
  ...TOP_COMBO_CITIES.flatMap((citySlug) => {
    const city = NJ_CITIES.find((c) => c.slug === citySlug);
    if (!city) return [];
    return EVENT_TYPES.map((type) => buildComboTopic(city, type));
  }),
  ...TIME_TOPICS,
  ...TENTPOLE_TOPICS,
];

const TOPIC_INDEX = new Map(ALL_TOPICS.map((t) => [t.slug, t]));

export function getTopicConfig(slug: string): TopicConfig | null {
  return TOPIC_INDEX.get(slug) || null;
}

export function getAllTopics(): TopicConfig[] {
  return ALL_TOPICS;
}

export function getAllTopicSlugs(): string[] {
  return ALL_TOPICS.map((t) => t.slug);
}

export function getCitySlug(cityName: string | null | undefined): string | null {
  if (!cityName) return null;
  const target = cityName.trim().toLowerCase();
  return NJ_CITIES.find((c) => c.name.toLowerCase() === target)?.slug || null;
}

export function getCityName(slug: string): string | null {
  return NJ_CITIES.find((c) => c.slug === slug)?.name || null;
}

export function getRelatedCityLinks(): { slug: string; name: string }[] {
  return NJ_CITIES.map((c) => ({ slug: `things-to-do-in-${c.slug}`, name: c.name }));
}

export function getRelatedTypeLinks(): { slug: string; label: string }[] {
  return EVENT_TYPES.map((t) => ({ slug: `${t.slug}-in-nj`, label: `${t.label}s` }));
}

interface EventLike {
  date?: string | null;
  city?: string | null;
  genre?: string | null;
}

// Count how many events in `events` would match a topic's filter. Used by the
// server to decide whether a Tier 2 topic should noindex itself this week.
export function countMatchingEvents(events: EventLike[], filter: TopicConfig["filter"]): number {
  const lockedCity = filter.city?.trim().toLowerCase();
  const lockedGenre = filter.genre?.map((g) => g.toLowerCase());
  const lockedDays = filter.days;
  let n = 0;
  for (const e of events) {
    if (lockedCity && (e.city || "").trim().toLowerCase() !== lockedCity) continue;
    if (lockedGenre && lockedGenre.length > 0) {
      const g = (e.genre || "").trim().toLowerCase();
      if (!lockedGenre.some((m) => g.includes(m))) continue;
    }
    if (lockedDays && lockedDays.length > 0 && e.date) {
      const d = dayOfWeek(e.date);
      if (!d || !lockedDays.includes(d)) continue;
    }
    n++;
  }
  return n;
}

function dayOfWeek(dateStr: string): string | null {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const date = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()] ?? null;
}
