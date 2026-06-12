export type SiteMode = "official" | "serial";

export interface SiteNavigationItem {
  label: string;
  href: string;
  external?: boolean;
}

export interface ViewerSiteConfig {
  mode: SiteMode;
  origin: string;
  title: string;
  description: string;
  brand: {
    label: string;
    githubUrl: string;
  };
  navigation: SiteNavigationItem[];
  features: {
    worksIndex: boolean;
    demo: boolean;
    showcase: boolean;
    githubCta: boolean;
    docsCta: boolean;
    purchase: boolean;
    redeem: boolean;
    feedback: boolean;
  };
  content: {
    allowedSeriesIds?: string[];
    demoSeriesIds: string[];
    requirePublicSafeSamples: boolean;
  };
}

const rawMode = import.meta.env.SITE_MODE as string | undefined;
const mode: SiteMode = rawMode === "official" ? "official" : "serial";
const origin = (import.meta.env.SITE_ORIGIN as string | undefined) ?? "https://manga-cms.com";
const githubUrl = "https://github.com/manga-cms/manga-cms";
const parseIdList = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

const demoSeriesIds = parseIdList(import.meta.env.SITE_DEMO_SERIES_IDS as string | undefined);
const allowedSeriesIds = parseIdList(import.meta.env.SITE_ALLOWED_SERIES_IDS as string | undefined);

const officialNavigation: SiteNavigationItem[] = [
  { label: "GitHub", href: githubUrl, external: true },
];

const serialNavigation: SiteNavigationItem[] = [{ label: "Works", href: "/works" }];

export const siteConfig: ViewerSiteConfig = {
  mode,
  origin,
  title: mode === "official" ? "Manga CMS — マンガを、あまねく届けるためのオープンソース基盤" : "Manga Viewer",
  description:
    mode === "official"
      ? "マンガを、あまねく届けるためのオープンソース基盤"
      : "読みやすく、共有しやすく、翻訳しやすいマンガビューアー",
  brand: {
    label: mode === "official" ? "Manga CMS" : "Manga Viewer",
    githubUrl,
  },
  navigation: mode === "official" ? officialNavigation : serialNavigation,
  features: {
    worksIndex: mode === "serial",
    demo: mode === "official",
    showcase: false,
    githubCta: true,
    docsCta: false,
    purchase: mode === "serial",
    redeem: mode === "serial",
    feedback: true,
  },
  content: {
    allowedSeriesIds: allowedSeriesIds.length > 0 ? allowedSeriesIds : undefined,
    demoSeriesIds,
    requirePublicSafeSamples: mode === "official",
  },
};

export const isOfficialSite = siteConfig.mode === "official";
