import {
  composePageOgPng,
  fallbackPng,
  fetchImageBuffer,
  pngResponse,
  resolveOgSourceImageUrl,
} from "../../../../../lib/og-image";
import { selectPageImage } from "../../../../../lib/localized-metadata";
import { resolveShareRoute } from "../../../../../lib/share-url-metadata";

export const prerender = false;

export async function GET({ params, request }: { params: Record<string, string | undefined>; request: Request }) {
  const seriesId = params.seriesId || "";
  const episodeId = params.episodeId || "";
  const pageNumber = Number(params.pageNumber);
  if (!seriesId || !episodeId || !Number.isInteger(pageNumber) || pageNumber < 1) {
    return new Response(null, { status: 404, statusText: "Not Found" });
  }

  const siteOrigin = import.meta.env.SITE_ORIGIN as string | undefined;
  const origin = siteOrigin ? new URL(siteOrigin).origin : new URL(request.url).origin;
  const locale = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "ja";
  const resolved = await resolveShareRoute({ seriesId, episodeId, pageNumber, locale, origin });
  if (!resolved?.page || resolved.kind !== "page") {
    return new Response(null, { status: 404, statusText: "Not Found" });
  }

  const title = resolved.series?.title || seriesId;
  const subtitle = `${resolved.episode?.title || episodeId} / Page ${resolved.page.pageNumber}`;
  const src = resolveOgSourceImageUrl(selectPageImage(resolved.page, locale), request.url);
  if (!src) return fallbackPng(title, subtitle);

  try {
    const source = await fetchImageBuffer(src);
    if (!source) return fallbackPng(title, subtitle);
    return pngResponse(await composePageOgPng(source));
  } catch {
    return fallbackPng(title, subtitle);
  }
}
