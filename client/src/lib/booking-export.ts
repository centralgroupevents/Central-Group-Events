import Papa from "papaparse";
import type { Booking } from "@shared/schema";

type BookingExportRecord = Omit<Booking, "createdAt" | "contactedAt" | "paidAt" | "completedAt"> & {
  createdAt: string | null;
  contactedAt: string | null;
  paidAt: string | null;
  completedAt: string | null;
};

export function buildBookingsCsv(bookings: BookingExportRecord[]): string {
  const fields = [
    "Submitted", "Contact Name", "Email", "Package", "Event Name", "Event Date",
    "City/Region", "Status", "Booking ID", "Reference ID", "Phone Number",
    "Event Time", "Venue Name", "City", "Region", "Event Type",
    "Describe Your Event", "Budget Range", "Instagram Handle",
    "Ready to Move Forward", "Expected Attendance", "Team Size", "Internal Notes",
    "Contacted At", "Paid At", "Completed At",
  ];
  const data = bookings.map((b) => [
    b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-US") : "",
    b.contactName ?? "",
    b.email,
    b.mode || "Standard",
    b.eventName ?? "",
    b.eventDate ? new Date(b.eventDate + "T00:00:00").toLocaleDateString("en-US") : "",
    b.city ? `${b.city}, ${b.region}` : b.region,
    b.status || "New",
    b.id,
    b.referenceId ?? "",
    b.phone ?? "",
    b.eventTime ?? "",
    b.venueName,
    b.city ?? "",
    b.region,
    b.eventType,
    b.eventTypeOther ?? "",
    b.budgetRange ?? "",
    b.instagramHandle ?? "",
    b.readyToMoveForward ?? "",
    // Neither booking form currently collects these details. Keep the requested
    // columns empty rather than inventing attendance or team-size values.
    "",
    "",
    b.adminNotes ?? "",
    b.contactedAt ?? "",
    b.paidAt ?? "",
    b.completedAt ?? "",
  ]);

  return Papa.unparse({ fields, data }, { quotes: true, escapeFormulae: true });
}
