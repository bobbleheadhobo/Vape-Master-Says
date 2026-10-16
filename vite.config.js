import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Serves the local SQLite player API in both dev and preview. Loaded lazily
// so `vite build` doesn't need node:sqlite.
const playerApi = () => {
  const useApi = async (server) => {
    const { apiMiddleware } = await import("./server/api.js");
    server.middlewares.use(apiMiddleware);
  };
  return {
    name: "player-api",
    configureServer: useApi,
    configurePreviewServer: useApi,
  };
};

// Applied to pages and static assets served by `vite preview` (the live site)
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), playerApi()],
    server: {
      host: true, // Bind to all interfaces so reverse proxy can reach it
      // Allow your domain
      allowedHosts: env.VITE_ALLOWED_HOST ? [env.VITE_ALLOWED_HOST] : [],
      fs: {
        // Vite's defaults, plus the player database: the dev server would
        // otherwise serve data/vape-master.db to anyone who asks for it
        deny: [
          ".env",
          ".env.*",
          "*.{crt,pem,key,p12,pfx,cer,der}",
          ".npmrc",
          ".yarnrc.yml",
          "**/.git/**",
          "**/data/**",
          "*.db",
          "*.db-*",
        ],
      },
    },
    preview: {
      host: true,
      headers: securityHeaders,
    },
  };
});
