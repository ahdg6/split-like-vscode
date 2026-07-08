import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@worksplit\/core$/,
        replacement: fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
      },
      {
        find: /^@worksplit\/react$/,
        replacement: fileURLToPath(new URL("../react/src/index.ts", import.meta.url)),
      },
    ],
  },
  server: {
    port: 5174,
  },
});
