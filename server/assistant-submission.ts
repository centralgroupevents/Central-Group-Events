import { v2 as cloudinary } from "cloudinary";
import { db } from "./db";
import { events, eventOrganizerContacts } from "@shared/schema";
import { submitAssistantEventSchema } from "@shared/assistant";

export const EVENT_PLACEHOLDER = "/images/event-placeholder.svg";
export async function submitAssistantEvent(raw: unknown, database: Pick<typeof db, "transaction"> = db) {
  const parsed = submitAssistantEventSchema.parse(raw);
  const { organizerEmail, ...event } = parsed;
  return database.transaction(async tx => {
    const [created] = await tx.insert(events).values({
      ...event,
      description: event.description || event.title,
      imageUrl: event.imageUrl || EVENT_PLACEHOLDER,
      instagramHandle: event.instagramHandle.replace(/^@/, "") || null,
      ticketLink: event.ticketLink || null,
      isFeatured: false,
    }).returning({ id: events.id });
    await tx.insert(eventOrganizerContacts).values({ eventId: created.id, email: organizerEmail.toLowerCase() });
    return { id: created.id, message: "Your event is on the CGE calendar. You’re all set!" };
  });
}

export function isFlyerImage(buffer: Buffer, mime: string): boolean {
  if (mime === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === "image/webp") return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  return false;
}

export async function uploadAssistantFlyer(buffer: Buffer) {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("Upload not configured");
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder: "cge/assistant-flyers", resource_type: "image", timeout: 20000,
      transformation: [{ width: 1600, height: 1600, crop: "limit" }],
    }, (error, result) => {
      if (error || !result?.secure_url) reject(new Error("Flyer upload failed"));
      else resolve(result.secure_url);
    });
    stream.end(buffer);
  });
}
