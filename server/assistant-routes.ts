import type { Express } from "express";
import rateLimit from "express-rate-limit";
import { chatInputSchema } from "@shared/assistant";
import { AssistantUnavailable, chatWithAssistant } from "./event-assistant";
import multer from "multer";
import { z } from "zod";
import { isFlyerImage, submitAssistantEvent, uploadAssistantFlyer } from "./assistant-submission";
import { AssistantRateStore } from "./assistant-rate-store";

export function registerAssistantRoutes(app: Express) {
  const submissionLimiter = rateLimit({
    store: new AssistantRateStore("submit", 3600000),
    windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false,
    message: { message: "You’ve reached the event submission limit. Please try again in an hour." },
  });
  const uploadLimiter = rateLimit({
    store: new AssistantRateStore("upload", 3600000),
    windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false,
    message: { message: "You’ve reached the flyer upload limit. Please try again in an hour." },
  });
  const flyerUpload = multer({
    storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
    fileFilter: (_req, file, cb) => {
      if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) cb(null, true);
      else cb(new Error("Use a JPG, PNG, or WebP image"));
    },
  }).single("file");
  app.post("/api/assistant/upload-flyer", uploadLimiter, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    flyerUpload(req, res, async error => {
      if (error) return res.status(400).json({ message: "Upload one JPG, PNG, or WebP image, no larger than 5 MB." });
      if (!req.file || !isFlyerImage(req.file.buffer, req.file.mimetype)) {
        return res.status(400).json({ message: "The file is not a supported image." });
      }
      try {
        return res.json({ url: await uploadAssistantFlyer(req.file.buffer) });
      } catch {
        return res.status(503).json({ message: "Flyer upload is unavailable. Try again or submit without a flyer." });
      }
    });
  });
  app.post("/api/assistant/submit-event", submissionLimiter, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      return res.status(201).json(await submitAssistantEvent(req.body));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0].message, field: error.issues[0].path.join(".") });
      console.error("[assistant/submit-event] database operation failed");
      return res.status(500).json({ message: "Your event wasn’t saved. Please try again." });
    }
  });
  const chatLimiter = rateLimit({
    store: new AssistantRateStore("chat", 3600000),
    windowMs: 60 * 60 * 1000, limit: 20,
    standardHeaders: "draft-7", legacyHeaders: false,
    message: { message: "You’ve reached 20 messages this hour. Please try again later." },
  });
  app.post("/api/assistant/chat", chatLimiter, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const input = chatInputSchema.safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: "Send a message up to 1,000 characters and at most 12 user/assistant history messages." });
    try {
      return res.json(await chatWithAssistant(input.data));
    } catch (error) {
      console.error("[assistant/chat] failed", error instanceof AssistantUnavailable ? error.message : "Invalid response or search failure");
      return res.status(503).json({ message: "The assistant is temporarily unavailable. Please try again, or browse the event calendar below." });
    }
  });
}
