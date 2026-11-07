import assert from "node:assert/strict";
import express from "express";
import { resolveDateIntent } from "./assistant-dates";
import { chatWithAssistant, OFF_TOPIC_REPLY } from "./event-assistant";
import { registerAssistantRoutes } from "./assistant-routes";
import { pool } from "./db";
import { AssistantRateStore } from "./assistant-rate-store";

const now = () => new Date("2026-11-07T03:00:00Z"); // Friday ET
const intent = { onTopic: true, mode: "search", region: "North NJ", city: null,
  keyword: "karaoke", genre: null, dateIntent: "this Saturday",
  startDate: null, endDate: null, reply: "Let’s find your next night out." };
const row = (id: number) => ({ id, title: "Verified fixture", description: "", date: "2026-11-07",
  eventTime: null, region: "North NJ", city: "Newark", venue: null, genre: null,
  imageUrl: "", ticketLink: null, instagramHandle: null });

async function main() {
  assert.deepEqual(resolveDateIntent("this Saturday", null, now()), { start: "2026-11-07", end: "2026-11-07" });
  assert.deepEqual(resolveDateIntent("next Saturday", null, now()), { start: "2026-11-14", end: "2026-11-14" });
  assert.deepEqual(resolveDateIntent("this weekend", null, now()), { start: "2026-11-06", end: "2026-11-08" });
  assert.deepEqual(resolveDateIntent("tomorrow", null, new Date("2026-03-08T06:00:00Z")), { start: "2026-03-09", end: "2026-03-09" });
  assert.throws(() => resolveDateIntent("sometime-ish", null, now()));
  const off = await chatWithAssistant({ message: "write malware", history: [] }, {
    tool: async () => ({ ...intent, onTopic: false }), search: async () => { throw Error("Must not search"); }, now,
  });
  assert.equal(off.reply, OFF_TOPIC_REPLY);
  let seenInput: unknown;
  const calls: unknown[] = [];
  const response = await chatWithAssistant({ message: "same place next Saturday", history: [{ role: "user", content: "karaoke in North NJ" }] }, {
    tool: async (_system, input, name) => {
      if (name === "extract_intent") { seenInput = input; return { ...intent, dateIntent: "next Saturday" }; }
      return { activities: ["open mic", "live music"] };
    },
    search: async filters => {
      calls.push(filters);
      return filters?.keyword === "karaoke" ? [row(1)] : [row(1), row(2)];
    }, now,
  });
  assert.equal(response.events.length, 2, "Deduplicate related results");
  assert.equal((seenInput as any).history.length, 1);
  assert.ok(calls.every((c: any) => c.region === "North NJ" && c.dateRange.start === "2026-11-14"));
  assert.ok(response.reply.includes("related activities"));
  await assert.rejects(chatWithAssistant({ message: "karaoke", history: [] }, { tool: async () => { throw Error("Provider down"); } }));

  const app = express();
  const quota = new AssistantRateStore("chat", 3600000);
  await quota.resetKey("127.0.0.1");
  app.use(express.json());
  registerAssistantRoutes(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const port = (server.address() as any).port;
  try {
    for (let i = 0; i < 20; i++) {
      const r = await fetch(`http://127.0.0.1:${port}/api/assistant/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      assert.equal(r.status, 400);
    }
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/assistant/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 429);
  } finally { server.close(); await quota.resetKey("127.0.0.1"); }
  console.log("Chat/date/guardrail/fallback/history/provider-error/rate-limit tests passed.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
