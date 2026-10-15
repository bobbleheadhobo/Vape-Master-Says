import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { apiMiddleware } from "./server/api.js";

// Serves the local SQLite player API in both dev and preview
const playerApi = () => ({
  name: "player-api",
  configureServer(server) {
    server.middlewares.use(apiMiddleware);
  },
  configurePreviewServer(server) {
    server.middlewares.use(apiMiddleware);
  },
});

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), playerApi()],
    server: {
      host: true, // Bind to all interfaces so reverse proxy can reach it
      // Allow your domain
      allowedHosts: env.VITE_ALLOWED_HOST ? [env.VITE_ALLOWED_HOST] : [],
    },
    preview: {
      host: true,
    },
  };
});
