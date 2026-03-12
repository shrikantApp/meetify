import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import viteTsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  base: "/",
  plugins: [react(), viteTsconfigPaths()],
  optimizeDeps: {
    include: ["react-icons/pi", "react-icons/fa6", "react-icons/vsc"],
  },
  build: {
    outDir: "dist",
    sourcemap: false
  },
});
