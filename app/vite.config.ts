import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@worksplit\/core$/,
        replacement: fileURLToPath(new URL("../packages/core/src/index.ts", import.meta.url)),
      },
      {
        find: /^@worksplit\/react$/,
        replacement: fileURLToPath(new URL("../packages/react/src/index.ts", import.meta.url)),
      },
      {
        find: /^@douyinfe\/semi-ui\/dist\/css\/semi\.min\.css$/,
        replacement: fileURLToPath(
          new URL("./node_modules/@douyinfe/semi-ui/dist/css/semi.min.css", import.meta.url),
        ),
      },
    ],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
