import { defineConfig } from 'astro/config';

// Static output. The app is a single client-rendered page (src/pages/index.astro)
// that talks to the Cloudflare Worker in worker/. No adapter, no SSR.
export default defineConfig({
  site: 'https://brambletally.com',
});
