import type { APIRoute } from "astro";
import { siteConfig } from "../lib/site-config";

export const GET: APIRoute = () => {
  const origin = new URL(siteConfig.origin).origin;
  const body = [
    "User-agent: *",
    "Disallow: /og/",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
