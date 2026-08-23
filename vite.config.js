import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The React admin app lives in admin-app/ as its own Vite project root,
// kept separate from the rest of the repo (marketing site, portal/,
// quote-tool/, the legacy admin/ vanilla app) which all continue to
// deploy as plain static files with no build step. Run with
// `npm run admin:dev` / `npm run admin:build`.
export default defineConfig({
  root: 'admin-app',
  plugins: [react()],
  build: {
    outDir: '../admin-app-dist',
    emptyOutDir: true,
  },
});
