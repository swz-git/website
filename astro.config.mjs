// @ts-check
import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";

export default defineConfig({
    site: "https://rlbot.org",
    vite: {
        build: {
            cssMinify: "lightningcss",
            minify: "oxc",
            sourcemap: false,
        },
    },
    integrations: [svelte()],
});
