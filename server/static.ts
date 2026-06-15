import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { getMetaForRoute, injectSeoIntoHtml } from "./seo";
import { storage } from "./storage";

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
      // Slug-rename redirect: if the path is /<old-slug> and that slug has
      // been renamed in the admin, 301 to the new slug. Preserves inbound
      // Google traffic from before the rename. Skip for paths that look
      // like API/asset routes (paranoia — express.static already handled those).
      const cleanPath = req.path.replace(/^\/+/, "").replace(/\/$/, "");
      if (cleanPath && !cleanPath.includes("/") && !cleanPath.includes(".")) {
        const redirectTo = await storage.getPageRedirect(cleanPath);
        if (redirectTo) {
          return res.redirect(301, `/${redirectTo}`);
        }
      }
      const meta = await getMetaForRoute(req.path);
      const html = injectSeoIntoHtml(indexHtml, meta);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch {
      res.sendFile(indexHtmlPath);
    }
  });
}
