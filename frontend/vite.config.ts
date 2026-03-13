import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import viteTsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  base: "/",
  plugins: [react(), viteTsconfigPaths()],
  optimizeDeps: {
    include: ["react-icons/pi", "react-icons/fa6", "react-icons/vsc"],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4004',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false
  },
});
