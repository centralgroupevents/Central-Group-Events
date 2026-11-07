import assert from "node:assert/strict";
import React from "react";
// @ts-ignore test-only renderer
import { create, act } from "react-test-renderer";
import { useEventAssistant } from "./use-event-assistant";

const saved = new Map<string, string>();
(globalThis as any).window = { setTimeout, clearTimeout, sessionStorage: {
  getItem: (key: string) => saved.get(key) ?? null,
  setItem: (key: string, value: string) => saved.set(key, value),
} };
let hook: ReturnType<typeof useEventAssistant>;
function Harness() { hook = useEventAssistant(); return React.createElement("div"); }
let instance: any;
const requests: any[] = [];
(globalThis as any).fetch = async (_url: string, options: any) => {
  requests.push(JSON.parse(options.body));
  return { ok: true, json: async () => ({ reply: "Here’s what’s good.", events: [] }) };
};
await act(async () => { instance = create(React.createElement(Harness)); });
await act(async () => { assert.equal(await hook.sendMessage("karaoke"), true); });
assert.equal(hook!.messages.length, 2);
assert.equal(requests[0].history.length, 0);
await act(async () => { await hook.sendMessage("same place tomorrow"); });
assert.equal(requests[1].history.length, 2);
await act(async () => { instance.unmount(); instance = create(React.createElement(Harness)); });
assert.equal(hook!.messages.length, 4, "Navigation remount restores chat");
(globalThis as any).fetch = async () => ({ ok: false, json: async () => ({ message: "Try later" }) });
await act(async () => { assert.equal(await hook.sendMessage("failed request"), false); });
assert.equal(hook!.messages.length, 4);
assert.equal(hook!.error, "Try later");
assert.equal(hook!.loading, false);
(globalThis as any).fetch = async () => ({ ok: true, json: async () => ({ id: 123, message: "Saved" }) });
await act(async () => { assert.equal((await hook.submitEvent({ organizerEmail: "private@example.com" } as any))?.id, 123); });
assert.ok(!Array.from(saved.values()).join("").includes("private@example.com"));
await act(async () => { instance.unmount(); });
console.log("Hook send/history/navigation/error-retry/submission privacy checks passed.");
