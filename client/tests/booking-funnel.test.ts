import assert from "node:assert/strict";
import { test } from "node:test";
import { PACKAGES, getIncludedPackageFeatures } from "../src/lib/promotion-packages";
import { getNextPromotionWindow } from "../src/lib/promotion-window";

test("promotion window is the strictly upcoming Monday on the Eastern calendar", () => {
  const cases = [
    ["2026-07-05T16:00:00Z", "July 6, 2026"],
    ["2026-07-06T03:59:59Z", "July 6, 2026"], // Still Sunday in NJ.
    ["2026-07-06T04:00:00Z", "July 13, 2026"], // Monday starts in NJ.
    ["2026-07-07T16:00:00Z", "July 13, 2026"],
    ["2026-12-31T18:00:00Z", "January 4, 2027"],
    ["2026-03-08T06:59:59Z", "March 9, 2026"], // Spring DST transition.
    ["2026-03-08T07:00:00Z", "March 9, 2026"],
    ["2026-03-09T04:00:00Z", "March 16, 2026"],
    ["2026-11-01T05:59:59Z", "November 2, 2026"], // Fall DST transition.
    ["2026-11-01T06:00:00Z", "November 2, 2026"],
    ["2026-11-02T04:59:59Z", "November 2, 2026"],
    ["2026-11-02T05:00:00Z", "November 9, 2026"],
    ["2028-02-29T18:00:00Z", "March 6, 2028"],
  ];
  for (const [now, expected] of cases) {
    assert.equal(getNextPromotionWindow(new Date(now)), expected, now);
  }
});

test("payment features expand every inherited tier without changing card copy or prices", () => {
  const starter = [
    "Event calendar listing", "Instagram story feature", "Newsletter mention", "Facebook post",
  ];
  const growth = [
    ...starter, "Instagram reel feature", "Premium newsletter placement", "SMS blast to subscribers",
  ];
  assert.deepEqual(getIncludedPackageFeatures("Basic"), ["Event calendar listing"]);
  assert.deepEqual(getIncludedPackageFeatures("Starter"), starter);
  assert.deepEqual(getIncludedPackageFeatures("Growth"), growth);
  assert.deepEqual(getIncludedPackageFeatures("Custom"), [
    ...growth, "Influencer reposts", "Strategy call included", "Custom campaign timeline",
  ]);
  assert.deepEqual(PACKAGES.map(pkg => pkg.price), ["FREE", "$70", "$150", "$300+"]);
  assert.equal(PACKAGES[2].features[0], "Everything in Starter");
  assert.equal(PACKAGES[3].features[0], "Everything in Growth");
  assert.deepEqual(getIncludedPackageFeatures("unknown"), []);
});
