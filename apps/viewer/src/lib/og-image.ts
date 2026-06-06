import sharp from "sharp";

export const OGP_CANVAS_WIDTH = 1200;
export const OGP_CANVAS_HEIGHT = 630;
export const PANEL_OG_MAX_EDGE = 1200;

const BACKGROUND = { r: 246, g: 246, b: 244, alpha: 1 };
const API_BASE = (typeof process !== "undefined" && process.env?.API_BASE) || "";

export interface PanelCropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OgImageSize {
  width: number;
  height: number;
}

const safeText = (value: unknown) =>
  String(value ?? "")
    .replace(/[<>&"]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const fallbackSvg = (title: string, subtitle: string) => `
  <svg width="${OGP_CANVAS_WIDTH}" height="${OGP_CANVAS_HEIGHT}" viewBox="0 0 ${OGP_CANVAS_WIDTH} ${OGP_CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${OGP_CANVAS_WIDTH}" height="${OGP_CANVAS_HEIGHT}" fill="#f6f6f4"/>
    <rect x="86" y="70" width="340" height="490" fill="#ffffff" stroke="#d8d8d4" stroke-width="2"/>
    <rect x="126" y="120" width="260" height="92" fill="#eeeeea"/>
    <rect x="126" y="238" width="260" height="122" fill="#eeeeea"/>
    <rect x="126" y="388" width="260" height="112" fill="#eeeeea"/>
    <text x="500" y="260" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="700" fill="#1f1f1f">${safeText(title)}</text>
    <text x="500" y="324" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#555">${safeText(subtitle)}</text>
  </svg>`;

export const pngResponse = (body: Uint8Array, status = 200) =>
  new Response(body, {
    status,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });

export const fallbackPng = async (title: string, subtitle: string, status = 200) =>
  pngResponse(await sharp(Buffer.from(fallbackSvg(title, subtitle))).png().toBuffer(), status);

const apiOrigin = () => {
  if (!API_BASE) return "";
  try {
    return new URL(API_BASE).origin;
  } catch {
    return "";
  }
};

export const resolveOgSourceImageUrl = (src: unknown, requestUrl: string) => {
  if (typeof src !== "string" || src.length === 0 || src === "/placeholder-page.svg") return null;
  if (src.includes("/contents/")) return null;
  if (/\/pages\/[^/]+\.(jpe?g|png|webp|gif)$/i.test(src)) return null;

  try {
    const url = new URL(src);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    const origin = apiOrigin();
    if (src.startsWith("/api/v1/") && origin) return new URL(src, origin).href;
    if (src.startsWith("/deliver/") && origin) return new URL(src, origin).href;
    if (src.startsWith("/")) return new URL(src, requestUrl).href;
  }
  return null;
};

export const fetchImageBuffer = async (src: string) => {
  const response = await fetch(src);
  if (!response.ok) return null;
  const type = response.headers.get("content-type") || "";
  if (!type.startsWith("image/")) return null;
  return Buffer.from(await response.arrayBuffer());
};

export const composePageOgPng = async (pageImage: Buffer) => {
  const contained = await sharp(pageImage)
    .rotate()
    .resize({
      width: OGP_CANVAS_WIDTH,
      height: OGP_CANVAS_HEIGHT,
      fit: "contain",
      background: BACKGROUND,
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: OGP_CANVAS_WIDTH,
      height: OGP_CANVAS_HEIGHT,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([{ input: contained, left: 0, top: 0 }])
    .png()
    .toBuffer();
};

const validPanelCrop = (crop: PanelCropBox) =>
  Number.isFinite(crop.x)
  && Number.isFinite(crop.y)
  && Number.isFinite(crop.width)
  && Number.isFinite(crop.height)
  && crop.width > 1
  && crop.height > 1;

export const panelOgImageSize = (panelBbox: PanelCropBox): OgImageSize | null => {
  if (!validPanelCrop(panelBbox)) return null;
  const aspect = panelBbox.width / panelBbox.height;
  if (!Number.isFinite(aspect) || aspect <= 0) return null;

  if (aspect >= 1) {
    return {
      width: PANEL_OG_MAX_EDGE,
      height: Math.max(1, Math.round(PANEL_OG_MAX_EDGE / aspect)),
    };
  }

  return {
    width: Math.max(1, Math.round(PANEL_OG_MAX_EDGE * aspect)),
    height: PANEL_OG_MAX_EDGE,
  };
};

export const composePanelOgPng = async (
  pageImage: Buffer,
  panelBbox: PanelCropBox,
  coordinateWidth: number,
  coordinateHeight: number,
) => {
  if (!validPanelCrop(panelBbox) || coordinateWidth <= 0 || coordinateHeight <= 0) return null;

  const metadata = await sharp(pageImage).rotate().metadata();
  if (!metadata.width || !metadata.height) return null;

  const scaleX = metadata.width / coordinateWidth;
  const scaleY = metadata.height / coordinateHeight;
  const left = Math.max(0, Math.floor(panelBbox.x * scaleX));
  const top = Math.max(0, Math.floor(panelBbox.y * scaleY));
  const width = Math.min(metadata.width - left, Math.ceil(panelBbox.width * scaleX));
  const height = Math.min(metadata.height - top, Math.ceil(panelBbox.height * scaleY));

  if (width <= 1 || height <= 1) return null;

  const outputSize = panelOgImageSize(panelBbox);
  if (!outputSize) return null;

  return sharp(pageImage)
    .rotate()
    .extract({ left, top, width, height })
    .resize({
      width: outputSize.width,
      height: outputSize.height,
      fit: "fill",
    })
    .png()
    .toBuffer();
};

export const composePanelCardOgPng = async (
  pageImage: Buffer,
  panelBbox: PanelCropBox,
  coordinateWidth: number,
  coordinateHeight: number,
) => {
  if (!validPanelCrop(panelBbox) || coordinateWidth <= 0 || coordinateHeight <= 0) return null;

  const metadata = await sharp(pageImage).rotate().metadata();
  if (!metadata.width || !metadata.height) return null;

  const scaleX = metadata.width / coordinateWidth;
  const scaleY = metadata.height / coordinateHeight;
  const left = Math.max(0, Math.floor(panelBbox.x * scaleX));
  const top = Math.max(0, Math.floor(panelBbox.y * scaleY));
  const width = Math.min(metadata.width - left, Math.ceil(panelBbox.width * scaleX));
  const height = Math.min(metadata.height - top, Math.ceil(panelBbox.height * scaleY));

  if (width <= 1 || height <= 1) return null;

  const contained = await sharp(pageImage)
    .rotate()
    .extract({ left, top, width, height })
    .resize({
      width: OGP_CANVAS_WIDTH,
      height: OGP_CANVAS_HEIGHT,
      fit: "contain",
      background: BACKGROUND,
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: OGP_CANVAS_WIDTH,
      height: OGP_CANVAS_HEIGHT,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([{ input: contained, left: 0, top: 0 }])
    .png()
    .toBuffer();
};
