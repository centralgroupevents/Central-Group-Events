import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { api } from "../shared/routes";

// Exercise the real subscription block without starting the server, writing
// bookings, or sending confirmation emails.
const routes = ts.createSourceFile(
  "routes.ts",
  readFileSync(new URL("./routes.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
let subscriptionBlock: ts.IfStatement | undefined;
function findSubscription(node: ts.Node) {
  if (ts.isCallExpression(node) && node.expression.getText(routes) === "app.post"
    && node.arguments[0]?.getText(routes) === "api.bookings.create.path") {
    const handler = node.arguments[node.arguments.length - 1] as ts.ArrowFunction;
    function visit(child: ts.Node) {
      if (ts.isIfStatement(child)
        && child.expression.getText(routes) === "req.body.newsletterOptIn === true") {
        subscriptionBlock = child;
      }
      ts.forEachChild(child, visit);
    }
    visit(handler);
  }
  ts.forEachChild(node, findSubscription);
}
findSubscription(routes);
assert.ok(subscriptionBlock, "booking handler must retain the newsletter opt-in check");
const subscribe = new Function("storage", "req", "input", subscriptionBlock.getText(routes));

for (const [label, extra, expected] of [
  ["wizard with Basic package", { mode: "Basic", bookingSource: "wizard" }, "wizard"],
  ["wizard with Starter package", { mode: "Starter", bookingSource: "wizard" }, "wizard"],
  ["wizard with Growth package", { mode: "Growth", bookingSource: "wizard" }, "wizard"],
  ["wizard with Custom package", { mode: "Custom", bookingSource: "wizard" }, "wizard"],
  ["legacy Wizard mode", { mode: "Wizard" }, "wizard"],
  ["standard booking", { mode: "Starter" }, "booking"],
  ["booking without mode", {}, "booking"],
  ["unrecognized source", { mode: "Basic", bookingSource: "other" }, "booking"],
] as const) {
  test(label, () => {
    const body = {
      venueName: "Test venue", eventDate: "2027-01-01", region: "North NJ",
      eventType: "Concert", email: "Booker@example.com", contactName: "Booker",
      ...extra,
    };
    const input = api.bookings.create.input.parse(body);
    const calls: unknown[][] = [];
    const storage = { upsertSubscriber: (...args: unknown[]) => {
      calls.push(args);
      return Promise.resolve();
    } };
    subscribe(storage, { body: { ...body, newsletterOptIn: true } }, input);
    assert.deepEqual(calls, [["booker@example.com", expected, "Booker"]]);
    assert.equal(input.mode, "mode" in extra ? extra.mode : undefined);
    for (const newsletterOptIn of [false, undefined, "true"]) {
      calls.length = 0;
      subscribe(storage, { body: { ...body, newsletterOptIn } }, input);
      assert.deepEqual(calls, [], "only explicit opt-in subscribes");
    }
  });
}

test("wizard payload marks its source separately from the selected package", () => {
  const book = readFileSync(new URL("../client/src/pages/Book.tsx", import.meta.url), "utf8");
  assert.match(book, /const payload = \{\s*bookingSource: "wizard",\s*mode: data\.mode,/);
  const admin = readFileSync(new URL("../client/src/pages/Admin.tsx", import.meta.url), "utf8");
  assert.match(admin, /const SUB_SOURCES = \[[^\]]*"wizard"/);
});
