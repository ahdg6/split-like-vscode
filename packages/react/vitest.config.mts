import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packageRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(packageRoot, "../..");

function resolvePnpmPackage(packageName: string) {
  const storeRoot = join(workspaceRoot, "node_modules/.pnpm");
  const entry = readdirSync(storeRoot).find((name) => name.startsWith(`${packageName}@`));
  if (!entry) throw new Error(`Unable to resolve ${packageName} in ${storeRoot}`);
  return join(storeRoot, entry, "node_modules", packageName);
}

const reactRoot = resolvePnpmPackage("react");
const reactDomRoot = resolvePnpmPackage("react-dom");

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
