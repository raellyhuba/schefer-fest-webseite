import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.schefer-fest.ch',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'directory' },
  integrations: [sitemap()],
  adapter: cloudflare(),
});
