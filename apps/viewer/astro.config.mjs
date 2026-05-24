import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
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
    },
  },
});
