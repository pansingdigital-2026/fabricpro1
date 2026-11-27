// Build configuration for both environments:
//  - Inside Lovable: uses @lovable.dev/vite-tanstack-config (available there only).
//  - Anywhere else (Hostinger / any Node host): falls back to the equivalent
//    public plugins (@tanstack/react-start, @vitejs/plugin-react, tailwind,
//    tsconfig paths, nitro) so `npm install && npm run build` works standalone.
//
// @lovable.dev/vite-tanstack-config already includes the following — do NOT add
// them manually on the Lovable path or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss,
//     tsConfigPaths, nitro (build-only), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection.

const hostingerNitro = {
  preset: process.env["NITRO_PRESET"] || "node-server",
  // Hostinger starts the generated file directly. Keep the server runtime in
  // one entry so Node does not initialize TanStack's closely coupled middleware
  // modules through separate chunks. Dependencies remain normal Node imports;
  // forcing them inline breaks tslib interoperability.
  inlineDynamicImports: true,
};

const startOptions = {
  // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR
  // error wrapper). nitro/vite builds from this.
  server: { entry: "server" },
};

// Keep this optional package name indirect so standalone builders do not try
// to resolve a Lovable-only dependency before the fallback can run.
const lovableConfigPackage = "@lovable.dev/vite-tanstack-config";
const lovable = await import(/* @vite-ignore */ lovableConfigPackage).catch(
  () => null,
);

let config;
if (lovable) {
  // Inside the Lovable sandbox this nitro setting is ignored automatically.
  config = lovable.defineConfig({
    tanstackStart: startOptions,
    nitro: hostingerNitro,
  });
} else {
  // Portable path: standard plugins from public npm packages.
  const [{ defineConfig }, { tanstackStart }, viteReact, tailwindcss, tsConfigPaths, { nitro }] =
    await Promise.all([
      import("vite"),
      import("@tanstack/react-start/plugin/vite"),
      import("@vitejs/plugin-react"),
      import("@tailwindcss/vite"),
      import("vite-tsconfig-paths"),
      import("nitro/vite"),
    ]);

  config = defineConfig({
    plugins: [
      tsConfigPaths.default(),
      tailwindcss.default(),
      tanstackStart(startOptions),
      viteReact.default(),
      // Outside Lovable always build a plain Node server bundle at
      // .output/server/index.mjs instead of a Cloudflare Worker.
      nitro(hostingerNitro),
    ],
    resolve: {
      dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
    },
  });
}

export default config;
