import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const DIRECTIVE_WARNING_CODE = "MODULE_LEVEL_DIRECTIVE";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      onwarn(warning, warn) {
        const warningId = "id" in warning && typeof warning.id === "string" ? warning.id : "";

        if (warning.code === DIRECTIVE_WARNING_CODE && warningId.includes("/node_modules/")) {
          return;
        }

        warn(warning);
      }
    }
  }
});
