import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const host = new URL(process.env.SHOPIFY_APP_URL || "http://localhost").hostname;
let hmrConfig;

hmrConfig = host === "localhost"
  ? {
      protocol: "ws",
      host: "localhost",
      port: 64999,
      clientPort: 64999,
    }
  : {
      protocol: "wss",
      host,
      port: parseInt(process.env.FRONTEND_PORT) || 8002,
      clientPort: 443,
    };

export default defineConfig({
  server: {
    port: Number(process.env.PORT || 3000),
    hmr: hmrConfig,
    fs: {
      allow: ["app", "node_modules"],
    },
  },
  plugins: [
    remix({
      ignoredRouteFiles: ["**/.*"],
    }),
    tsconfigPaths(),
  ],
  build: {
    assetsInlineLimit: 0,
  },
});
