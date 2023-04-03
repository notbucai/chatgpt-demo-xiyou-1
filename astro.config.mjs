import { defineConfig } from 'astro/config';
import solidJs from '@astrojs/solid-js';
// import vercel from '@astrojs/vercel/edge';
import node from '@astrojs/node';
import tailwind from '@astrojs/tailwind';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  integrations: [solidJs(), tailwind(), react()],
  output: 'server',
  server: {
    host: '0.0.0.0',
  },
  // adapter: vercel({ analytics: true }),
  adapter: node({
    mode: 'standalone',
  }),
});
