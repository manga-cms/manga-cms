import { listSeries } from "../data/content";
import { fetchEpisode, fetchSeries, fetchSeriesList, isApiConfigured } from "./api-client";

export interface ViewerSeriesCard {
  id: string;
  title: string;
  description: string;
  publicationType: "serial" | "oneshot";
  lifecycleStatus: "ongoing" | "completed" | "hiatus";
  /** @deprecated Use lifecycleStatus. */
  status: string;
  coverUrl?: string;
  episodes: {
    id: string;
    title: string;
    episodeNumber: number;
  }[];
}

export type ViewerSeriesLike = Pick<ViewerSeriesCard, "id" | "publicationType" | "episodes">;

export const publicationTypeLabel = (publicationType: string | undefined) => {
  if (publicationType === "oneshot") return "読切";
  return "連載";
};

export const lifecycleStatusLabel = (status: string | undefined) => {
  if (status === "ongoing") return "連載中";
  if (status === "completed") return "完結";
  if (status === "hiatus") return "休載";
  if (status === "published" || status === "PUBLISHED") return "公開中";
  if (status === "draft" || status === "DRAFT") return "下書き";
  return status ?? "公開中";
};

export const latestEpisode = <T extends { episodeNumber: number }>(episodes: T[]) =>
  episodes.length > 0 ? episodes[episodes.length - 1] : undefined;

export const primaryOneshotEpisode = <T extends ViewerSeriesLike>(series: T) =>
  series.publicationType === "oneshot" && series.episodes.length === 1
    ? series.episodes[0]
    : undefined;

export const primarySeriesHref = (series: ViewerSeriesLike) => {
  const episode = primaryOneshotEpisode(series);
  return episode ? `/works/${series.id}/episodes/${episode.id}` : `/works/${series.id}`;
};

export const primarySeriesActionLabel = (series: ViewerSeriesLike) =>
  primaryOneshotEpisode(series) ? "読む" : "作品を見る";

function displayableCoverUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url === "/placeholder-cover.svg") return undefined;
  return url.startsWith("/") || /^https?:\/\//.test(url) ? url : undefined;
}

function firstPageImageUrl(images?: Record<string, string | undefined>): string | undefined {
  if (!images) return undefined;
  return images.ja ?? Object.values(images).find((value): value is string => Boolean(value));
}

function firstPageCoverFromLocalSeries(series: ReturnType<typeof listSeries>[number]): string | undefined {
  const firstEpisode = series.episodes.slice().sort((a, b) => a.episodeNumber - b.episodeNumber)[0];
  return displayableCoverUrl(firstPageImageUrl(firstEpisode?.pages[0]?.images));
}

export async function getViewerSeriesCards(): Promise<ViewerSeriesCard[]> {
  if (!isApiConfigured()) {
    return listSeries().map((series) => ({
      ...series,
      coverUrl: displayableCoverUrl(series.coverUrl) ?? firstPageCoverFromLocalSeries(series),
    }));
  }

  const list = await fetchSeriesList();
  if (!list.data?.items) return [];

  const details = await Promise.all(
    list.data.items.map(async (item) => {
      const detail = await fetchSeries(item.id);
      const coverUrl = displayableCoverUrl(item.coverUrl) ?? displayableCoverUrl(detail.data?.coverUrl);
      const firstEpisode = detail.data?.episodes.slice().sort((a, b) => a.episodeNumber - b.episodeNumber)[0];
      const firstPageCoverUrl = coverUrl || !firstEpisode
        ? undefined
        : displayableCoverUrl(
          firstPageImageUrl((await fetchEpisode(item.id, firstEpisode.id)).data?.episode.pages[0]?.images),
        );
      return { item, detail: detail.data, coverUrl: coverUrl ?? firstPageCoverUrl };
    }),
  );

  return details.map(({ item, detail, coverUrl }) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    publicationType: item.publicationType ?? "serial",
    lifecycleStatus: item.lifecycleStatus ?? item.status as "ongoing" | "completed" | "hiatus",
    status: item.status,
    coverUrl,
    episodes: detail?.episodes?.map((episode) => ({
      id: episode.id,
      title: episode.title,
      episodeNumber: episode.episodeNumber,
    })) ?? [],
  }));
}
