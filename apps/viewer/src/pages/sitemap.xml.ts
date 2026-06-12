import type { APIRoute } from "astro";
import { getViewerSeriesCards, primaryOneshotEpisode } from "../lib/series-cards";
import { siteConfig } from "../lib/site-config";

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const absoluteUrl = (origin: string, path: string) => new URL(path, origin).href;

const readerSitemapPaths = async (seriesIds?: readonly string[]) => {
  const series = await getViewerSeriesCards();
  const allowedIds = seriesIds && seriesIds.length > 0 ? new Set(seriesIds) : undefined;
  const paths = new Set<string>();

  for (const item of series) {
    if (allowedIds && !allowedIds.has(item.id)) continue;
    if (!primaryOneshotEpisode(item)) {
      paths.add(`/works/${encodeURIComponent(item.id)}`);
    }

    for (const episode of item.episodes) {
      paths.add(`/works/${encodeURIComponent(item.id)}/episodes/${encodeURIComponent(episode.id)}`);
    }
  }

  return [...paths];
};

const officialSitemapPaths = async () => [
  "/",
  "/license",
  ...(await readerSitemapPaths(siteConfig.content.demoSeriesIds)),
];

const serialSitemapPaths = async () => {
  const rootRedirectOrigin = import.meta.env.SITE_ROOT_REDIRECT_ORIGIN as string | undefined;
  const paths = new Set<string>(["/works", ...(await readerSitemapPaths())]);
  if (!rootRedirectOrigin) {
    paths.add("/");
  }
  return [...paths];
};

export const GET: APIRoute = async () => {
  const origin = new URL(siteConfig.origin).origin;
  const paths = siteConfig.mode === "official"
    ? await officialSitemapPaths()
    : await serialSitemapPaths();
  const urls = paths
    .map((path) => `  <url>\n    <loc>${xmlEscape(absoluteUrl(origin, path))}</loc>\n  </url>`)
    .join("\n");
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
};
