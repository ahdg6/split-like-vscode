import { createRequire } from "node:module";
import { dirname } from "node:path";

import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);

function resolvePackageRoot(packageName: string) {
  return dirname(require.resolve(packageName));
}

const reactRoot = resolvePackageRoot("react");
const reactDomRoot = resolvePackageRoot("react-dom");

const config: ReturnType<typeof defineConfig> = defineConfig({
  root: new URL(".", import.meta.url).pathname,
  resolve: {
    alias: [
      { find: /^react$/, replacement: reactRoot },
      { find: /^react\/(.*)$/, replacement: `${reactRoot}/$1` },
      { find: /^react-dom$/, replacement: reactDomRoot },
      { find: /^react-dom\/(.*)$/, replacement: `${reactDomRoot}/$1` },
    ],
    conditions: ["development"],
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
  },
});

export default config;
