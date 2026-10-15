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
