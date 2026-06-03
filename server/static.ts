import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { getMetaForRoute, injectSeoIntoHtml } from "./seo";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  const indexHtmlPath = path.resolve(distPath, "index.html");
  const indexHtml = fs.readFileSync(indexHtmlPath, "utf8");

  // SPA catch-all. For every URL that wasn't an API route, file, or sitemap,
  // we rewrite the head with per-route meta + JSON-LD so non-JS crawlers
  // (most AI engines, older bots) see the right content for the URL they asked for.
  app.use("/{*path}", async (req, res) => {
    try {
      const meta = await getMetaForRoute(req.path);
      const html = injectSeoIntoHtml(indexHtml, meta);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch {
      res.sendFile(indexHtmlPath);
    }
  });
}
