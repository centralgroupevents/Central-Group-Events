# Assistant cleanup for staging

The assistant stays withdrawn from the production release while this work is tested.

## Findings from the current implementation

- Calendar: EventBrowser uses useEvents, GET /api/events, and storage.getEvents.
  The public endpoint currently includes past rows.
- Assistant: searchEvents queries the same events table directly, limits results
  to eight, and excludes dates earlier than today in Eastern time.
- Keyword matching is literal substring matching across title, description,
  genre, venue and city. There is no deterministic activity synonym vocabulary.
  "running" need not match "5K" or "run club".
- The assistant prompt emphasizes nightlife and short replies. Search replies
  are written before results are fetched, then appended to a count and scope.
  The model does not synthesize an answer from retrieved event records.
- Related activities are generated only after sparse results. This is not
  reliable coverage of variants of the same activity.
- No verified live source outside the CGE catalog is connected.

These findings explain possible misses; they do not prove which running events
currently exist in the production database.

## Required staging behavior

1. Treat the calendar's underlying records as the source of truth. Reconcile
   date and visibility semantics explicitly without advertising past listings
   as upcoming events.
2. Cover all NJ social activities: running clubs, races, fitness meetups,
   hiking, arts, family activities, volunteering, networking, food, music and
   nightlife. Recognize related terms without silently dropping user constraints.
3. Retrieve first, then answer from the returned records. Explain why each
   recommendation fits; identify missing time, price, age or accessibility
   information instead of inventing it.
4. Preserve dates, regions, locations and interests through follow-ups. Ask a
   focused question when those constraints are ambiguous.
5. Distinguish general event advice from current event recommendations. General
   advice can help even without a catalog match, but must not invent schedules.
6. Say "no matching CGE listings" rather than claiming NJ has no relevant events.
   State clearly when information is unverified or unavailable.
7. Before promising statewide coverage beyond the catalog, select permitted,
   current external sources and establish freshness and source-link requirements.

## Acceptance cases before public re-enablement

- A synthetic "5K" and "Run Club" listing is found for "running events".
- Upcoming catalog events appear with their stored ticket links and details.
- Past events are never recommended as upcoming.
- North/Central/South NJ and date filters survive follow-ups.
- Family, hiking, volunteering and networking questions remain on topic.
- No matches produces useful honest guidance, not fabricated events.
- Results explain known details and explicitly mark unknowns.
- External recommendations, if added, include verified sources.
- Production routes remain blocked until separately approved.

This document records findings and acceptance criteria, not completed assistant
implementation or a provisioned staging environment.
