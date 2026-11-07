import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, pool } from "./db";
import { events } from "@shared/schema";
import { buildEventSearchQuery, easternToday, eventSearchFiltersSchema } from "./event-search";

async function main() {
  assert.equal(easternToday(new Date("2026-11-07T03:00:00Z")), "2026-11-06");
  assert.equal(easternToday(new Date("2026-07-01T03:59:59Z")), "2026-06-30");
  assert.equal(easternToday(new Date("2026-07-01T04:00:00Z")), "2026-07-01");
  assert.equal(easternToday(new Date("2026-11-01T06:30:00Z")), "2026-11-01");
  assert.throws(() => eventSearchFiltersSchema.parse({ dateRange: { start: "2026-02-30" } }));
  assert.throws(() => eventSearchFiltersSchema.parse({ dateRange: { start: "2026-12-02", end: "2026-12-01" } }));
  const rollback = new Error("ROLLBACK_TEST");
  try {
    await db.transaction(async tx => {
      const marker = randomUUID();
      const base = { title: marker, description: "", date: "2026-11-07", region: "north jersey", imageUrl: "" };
      for (const field of ["title", "description", "genre", "venue", "city"] as const) {
        await tx.insert(events).values({ ...base, title: "Search fixture", [field]: marker });
      }
      await tx.insert(events).values({ ...base, date: "2026-11-05" });
      await tx.insert(events).values({ ...base, region: "South NJ" });
      const now = new Date("2026-11-07T03:00:00Z");
      const rows = await buildEventSearchQuery({ keyword: marker, region: "North NJ", dateRange: { start: "2026-11-07", end: "2026-11-07" } }, now, tx);
      assert.equal(rows.length, 5, "Search covers all five text fields and inclusive date bounds");
      assert.equal((await buildEventSearchQuery({ keyword: marker, genre: marker }, now, tx)).length, 1);
      assert.equal((await buildEventSearchQuery({ keyword: `${marker}%` }, now, tx)).length, 0);
      assert.equal((await buildEventSearchQuery({ keyword: marker, dateRange: { end: "2026-11-05" } }, now, tx)).length, 0);
      await tx.insert(events).values(Array.from({ length: 10 }, (_, i) => ({ ...base, date: `2026-11-${String(10 + i).padStart(2, "0")}` })));
      const limited = await buildEventSearchQuery({ keyword: marker }, now, tx);
      assert.equal(limited.length, 8);
      assert.deepEqual(limited.map(r => r.date), limited.map(r => r.date).sort());
      assert.deepEqual(Object.keys(limited[0]).sort(), ["id", "title", "description", "date", "eventTime", "region", "city", "venue", "genre", "ticketLink", "imageUrl", "instagramHandle"].sort());
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log("Event search checks passed; all database fixtures rolled back.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
