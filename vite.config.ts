import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api/groq": {
          target: "https://api.groq.com",
          changeOrigin: true,
          secure: true,
          rewrite: (path) =>
            path.replace(/^\/api\/groq/, "/openai/v1/chat/completions"),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (env.GROQ_API_KEY) {
                proxyReq.setHeader("Authorization", `Bearer ${env.GROQ_API_KEY}`);
              }
              proxyReq.setHeader("Content-Type", "application/json");
            });
          }
        }
      }
    }
  };
});
