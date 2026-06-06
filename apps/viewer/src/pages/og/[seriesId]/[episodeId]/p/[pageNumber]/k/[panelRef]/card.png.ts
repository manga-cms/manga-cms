import {
  composePageOgPng,
  composePanelCardOgPng,
  fallbackPng,
  fetchImageBuffer,
  pngResponse,
  resolveOgSourceImageUrl,
} from "../../../../../../../../lib/og-image";
import { selectPageImage } from "../../../../../../../../lib/localized-metadata";
import { resolveShareRoute } from "../../../../../../../../lib/share-url-metadata";

export const prerender = false;

const numberFrom = (value: unknown) => Number(value);

export async function GET({ params, request }: { params: Record<string, string | undefined>; request: Request }) {
  const seriesId = params.seriesId || "";
  const episodeId = params.episodeId || "";
  const panelRef = params.panelRef || "";
  const pageNumber = Number(params.pageNumber);
  if (!seriesId || !episodeId || !panelRef || !Number.isInteger(pageNumber) || pageNumber < 1) {
    return new Response(null, { status: 404, statusText: "Not Found" });
  }

  const siteOrigin = import.meta.env.SITE_ORIGIN as string | undefined;
  const origin = siteOrigin ? new URL(siteOrigin).origin : new URL(request.url).origin;
  const locale = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "ja";
  const pageResolved = await resolveShareRoute({ seriesId, episodeId, pageNumber, locale, origin });
  if (!pageResolved?.page || pageResolved.kind !== "page") {
    return new Response(null, { status: 404, statusText: "Not Found" });
  }

  const title = pageResolved.series?.title || seriesId;
  const subtitle = `${pageResolved.episode?.title || episodeId} / Page ${pageResolved.page.pageNumber}`;
  const src = resolveOgSourceImageUrl(selectPageImage(pageResolved.page, locale), request.url);
  if (!src) return fallbackPng(title, subtitle);

  try {
    const source = await fetchImageBuffer(src);
    if (!source) return fallbackPng(title, subtitle);

    const panelResolved = await resolveShareRoute({ seriesId, episodeId, pageNumber, panelRef, locale, origin });
    const bbox = panelResolved?.panel?.bbox;
    const panelPng = panelResolved?.page && bbox
      ? await composePanelCardOgPng(
          source,
          {
            x: numberFrom(bbox.x),
            y: numberFrom(bbox.y),
            width: numberFrom(bbox.width),
            height: numberFrom(bbox.height),
          },
          numberFrom(panelResolved.page.width),
          numberFrom(panelResolved.page.height),
        )
      : null;

    return pngResponse(panelPng ?? await composePageOgPng(source));
  } catch {
    return fallbackPng(title, subtitle);
  }
}
