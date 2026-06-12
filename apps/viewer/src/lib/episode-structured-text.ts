export interface StructuredTextBubble {
  id: string;
  bubbleNumber: number;
  displayRef?: string;
  speaker?: string | null;
  bubbleType?: string;
  textOriginal: string;
}

export interface StructuredTextPanel {
  id: string;
  panelNumber: number;
  displayRef?: string;
  bubbles: StructuredTextBubble[];
}

export interface StructuredTextPage {
  id: string;
  pageNumber: number;
  displayRef?: string;
  panels: StructuredTextPanel[];
  pageBubbles: StructuredTextBubble[];
}

const splitEnvList = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const processEnv = () =>
  typeof process !== "undefined" ? process.env : {};

const idOf = (entity: any, primary: string, fallback = "id") =>
  String(entity?.[primary] ?? entity?.[fallback] ?? "");

const normalizeStatus = (value: unknown) => String(value ?? "").toLowerCase();

const isBlockedStatus = (value: unknown) =>
  ["deleted", "draft", "hidden", "archived", "scheduled", "expired", "gated"].includes(normalizeStatus(value));

const envEnablesStructuredText = (seriesId: string, episodeId: string) => {
  const env = processEnv();
  const seriesFlags = splitEnvList(env.READER_TEXT_VIEW_SERIES);
  const episodeFlags = splitEnvList(env.READER_TEXT_VIEW_EPISODES);
  const episodeKeys = new Set([
    `${seriesId}/${episodeId}`,
    `${seriesId}:${episodeId}`,
    episodeId,
  ]);
  return seriesFlags.includes(seriesId) || episodeFlags.some((item) => episodeKeys.has(item));
};

export const isStructuredTextViewEnabled = (input: {
  series: any;
  episode: any;
  seriesId: string;
  episodeId: string;
}) =>
  envEnablesStructuredText(input.seriesId, input.episodeId);

const publicBubbleTextAllowed = (bubble: any) => {
  if (!bubble) return false;
  if (isBlockedStatus(bubble.status)) return false;
  if (bubble.flags?.shareable === false) return false;
  return typeof bubble.textOriginal === "string" && bubble.textOriginal.trim().length > 0;
};

const bubbleIdOf = (bubble: any) => idOf(bubble, "bubbleId");
const panelIdOf = (panel: any) => idOf(panel, "panelId");

const bubbleForView = (bubble: any): StructuredTextBubble => ({
  id: bubbleIdOf(bubble),
  bubbleNumber: Number(bubble.bubbleNumber ?? 0),
  displayRef: bubble.displayRef ?? bubble.shortId,
  speaker: bubble.speaker ?? null,
  bubbleType: bubble.bubbleType,
  textOriginal: bubble.textOriginal,
});

const bubblesForPanel = (page: any, panel: any) => {
  const panelId = panelIdOf(panel);
  const nested = Array.isArray(panel?.bubbles) ? panel.bubbles : [];
  const pageBubbles = Array.isArray(page?.bubbles)
    ? page.bubbles.filter((bubble: any) => String(bubble.panelId ?? "") === panelId)
    : [];
  const byId = new Map<string, any>();
  for (const bubble of [...nested, ...pageBubbles]) {
    const id = bubbleIdOf(bubble);
    if (id) byId.set(id, bubble);
  }
  return [...byId.values()]
    .filter(publicBubbleTextAllowed)
    .sort((a, b) => Number(a.bubbleNumber ?? 0) - Number(b.bubbleNumber ?? 0))
    .map(bubbleForView);
};

const pageLevelBubbles = (page: any) =>
  (Array.isArray(page?.bubbles) ? page.bubbles : [])
    .filter((bubble: any) => !bubble.panelId)
    .filter(publicBubbleTextAllowed)
    .sort((a: any, b: any) => Number(a.bubbleNumber ?? 0) - Number(b.bubbleNumber ?? 0))
    .map(bubbleForView);

export const buildStructuredTextPages = (pages: any[]): StructuredTextPage[] =>
  [...(pages ?? [])]
    .sort((a, b) => Number(a.pageNumber ?? 0) - Number(b.pageNumber ?? 0))
    .map((page: any) => ({
      id: idOf(page, "pageId"),
      pageNumber: Number(page.pageNumber ?? 0),
      displayRef: page.displayRef,
      panels: [...(page.panels ?? [])]
        .sort((a, b) => Number(a.panelNumber ?? 0) - Number(b.panelNumber ?? 0))
        .map((panel: any) => ({
          id: panelIdOf(panel),
          panelNumber: Number(panel.panelNumber ?? 0),
          displayRef: panel.displayRef ?? panel.shortId ?? panel.stableRef,
          bubbles: bubblesForPanel(page, panel),
        }))
        .filter((panel) => panel.bubbles.length > 0),
      pageBubbles: pageLevelBubbles(page),
    }))
    .filter((page) => page.panels.length > 0 || page.pageBubbles.length > 0);

export const bubbleTypeLabel = (bubbleType: string | undefined) => {
  if (bubbleType === "thought") return "モノローグ";
  if (bubbleType === "narration") return "ナレーション";
  if (bubbleType === "sfx") return "効果音";
  if (bubbleType === "caption") return "キャプション";
  if (bubbleType === "other") return "その他";
  return "セリフ";
};
