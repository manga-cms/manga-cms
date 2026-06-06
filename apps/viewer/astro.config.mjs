import { defineConfig } from "astro/config";
import node from "@astrojs/node";

const siteOrigin =
  process.env.SITE_ORIGIN ?? process.env.PUBLIC_SITE_ORIGIN ?? "https://localhost";
const siteMode = process.env.SITE_MODE === "official" ? "official" : "serial";

export default defineConfig({
  site: siteOrigin,

  // Hybrid rendering: static by default, SSR opt-in per page.
  // Pages with `export const prerender = false` are server-rendered.
  output: "server",

  adapter: node({
    mode: "standalone",
  }),

  // Runtime env vars available to SSR pages
  vite: {
    define: {
      // Allow API_BASE to be read at runtime on the server
      "import.meta.env.API_BASE": JSON.stringify(process.env.API_BASE ?? ""),
      "import.meta.env.SITE_ORIGIN": JSON.stringify(siteOrigin),
      "import.meta.env.SITE_MODE": JSON.stringify(siteMode),
      "import.meta.env.SITE_READER_ORIGIN": JSON.stringify(process.env.SITE_READER_ORIGIN ?? ""),
      "import.meta.env.SITE_DEMO_SERIES_IDS": JSON.stringify(process.env.SITE_DEMO_SERIES_IDS ?? ""),
      "import.meta.env.SITE_ALLOWED_SERIES_IDS": JSON.stringify(process.env.SITE_ALLOWED_SERIES_IDS ?? ""),
      "import.meta.env.PUBLIC_INDEX_EN_LOCALE": JSON.stringify(process.env.PUBLIC_INDEX_EN_LOCALE ?? ""),
      "import.meta.env.PUBLIC_ANALYTICS_ENV": JSON.stringify(process.env.PUBLIC_ANALYTICS_ENV ?? ""),
      "import.meta.env.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_ENABLED": JSON.stringify(process.env.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_ENABLED ?? ""),
      "import.meta.env.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN": JSON.stringify(process.env.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN ?? ""),
      "import.meta.env.PUBLIC_ANALYTICS_ENABLED": JSON.stringify(process.env.PUBLIC_ANALYTICS_ENABLED ?? ""),
      "import.meta.env.PUBLIC_GA_MEASUREMENT_ID": JSON.stringify(process.env.PUBLIC_GA_MEASUREMENT_ID ?? ""),
    },
  },
});
