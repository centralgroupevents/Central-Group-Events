import assert from "node:assert/strict";
import { test } from "node:test";
import Papa from "papaparse";
import { buildBookingsCsv } from "./booking-export";

const booking = {
  id: 123, referenceId: "CGE-123", mode: "Growth", eventName: 'Music, "Live"',
  venueName: "Café 🎶", contactName: "Test Contact", phone: "555-0100",
  email: "test@example.com", eventDate: "2026-11-07", eventTime: "19:30",
  city: "Newark", region: "North NJ", eventType: "Other",
  eventTypeOther: "Community show", budgetRange: "$150", instagramHandle: "test",
  readyToMoveForward: "Yes", status: "Paid", adminNotes: 'Call "venue", then confirm\nSecond line',
  createdAt: "2026-11-01T12:00:00Z", contactedAt: "2026-11-02T12:00:00Z",
  paidAt: "2026-11-03T12:00:00Z", completedAt: null,
};

function parse(csv: string) {
  const result = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  assert.deepEqual(result.errors, []);
  return result;
}

test("exports all saved booking details with correctly escaped text", () => {
  const { data, meta } = parse(buildBookingsCsv([booking]));
  assert.equal(meta.fields?.length, 26);
  assert.equal(data.length, 1);
  const row = data[0];
  const expected = {
    "Contact Name": booking.contactName, Email: booking.email, Package: booking.mode,
    "Event Name": booking.eventName, "City/Region": "Newark, North NJ", Status: booking.status,
    "Booking ID": "123", "Reference ID": booking.referenceId, "Phone Number": booking.phone,
    "Event Time": booking.eventTime, "Venue Name": booking.venueName,
    City: booking.city, Region: booking.region, "Event Type": booking.eventType,
    "Describe Your Event": booking.eventTypeOther, "Budget Range": booking.budgetRange,
    "Instagram Handle": booking.instagramHandle, "Ready to Move Forward": booking.readyToMoveForward,
    "Expected Attendance": "", "Team Size": "", "Internal Notes": booking.adminNotes,
    "Contacted At": booking.contactedAt, "Paid At": booking.paidAt, "Completed At": "",
  };
  for (const [header, value] of Object.entries(expected)) assert.equal(row[header], value, header);
  assert.equal(row.Submitted, "11/1/2026");
  assert.equal(row["Event Date"], "11/7/2026");
});

test("empty exports retain headers and null legacy fields export as blanks", () => {
  const empty = parse(buildBookingsCsv([]));
  assert.equal(empty.data.length, 0);
  assert.ok(empty.meta.fields?.includes("Internal Notes"));
  const row = parse(buildBookingsCsv([{
    ...booking, mode: null, status: null, city: null, adminNotes: null,
    budgetRange: null, createdAt: null, phone: null,
  }])).data[0];
  assert.equal(row.Package, "Standard");
  assert.equal(row.Status, "New");
  assert.equal(row["City/Region"], "North NJ");
  for (const key of ["Internal Notes", "Budget Range", "Submitted", "Phone Number"]) {
    assert.equal(row[key], "");
  }
  assert.ok(!Object.values(row).includes("null"));
});

test("only supplied rows export, in order, and spreadsheet formulas are neutralized", () => {
  const rows = parse(buildBookingsCsv([
    { ...booking, id: 2, eventName: "=1+1", adminNotes: "@SUM(1,2)" },
    { ...booking, id: 1, contactName: "+123", venueName: "-1+2" },
  ])).data;
  assert.deepEqual(rows.map((r) => r["Booking ID"]), ["2", "1"]);
  assert.equal(rows[0]["Event Name"], "'=1+1");
  assert.equal(rows[0]["Internal Notes"], "'@SUM(1,2)");
  assert.equal(rows[1]["Contact Name"], "'+123");
  assert.equal(rows[1]["Venue Name"], "'-1+2");
});
