import { createReadStream } from 'node:fs';
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const quoteToolFiles = [
  ['quote-tool/index.html', 'quote-tool/index.html'],
  ['css/survey.css', 'css/survey.css'],
  ['css/quote-tool.css', 'css/quote-tool.css'],
  ['js/config.js', 'js/config.js'],
  ['js/quote-tool.js', 'js/quote-tool.js'],
  ['assets/favicon.png', 'assets/favicon.png'],
  ['assets/gg-shield.png', 'assets/gg-shield.png'],
];

const quoteToolDevFiles = new Map(quoteToolFiles.map(([source, target]) => [`/${target}`, source]));
const mimeType = (file) => ({ '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png' })[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream';

// Quotes/Invoices/Receipts remains its own vanilla application by design.
// This lightweight bridge lets React's Vite server host it unchanged, and
// includes exactly its required static files in the standalone build.
function quoteToolBridge() {
  return {
    name: 'quote-tool-bridge',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        const source = quoteToolDevFiles.get(pathname);
        if (!source) return next();
        const sourcePath = resolve(source);
        try {
          if (!(await stat(sourcePath)).isFile()) return next();
          response.setHeader('Content-Type', mimeType(sourcePath));
          createReadStream(sourcePath).pipe(response);
        } catch {
          next();
        }
      });
    },
    async writeBundle() {
      const outDir = resolve('admin-app-dist');
      await Promise.all(quoteToolFiles.map(async ([source, target]) => {
        const targetPath = resolve(outDir, target);
        await mkdir(dirname(targetPath), { recursive: true });
        await copyFile(resolve(source), targetPath);
      }));
    },
  };
}

// The React admin app lives in admin-app/ as its own Vite project root,
// kept separate from the rest of the repo (marketing site, portal/,
// quote-tool/, the legacy admin/ vanilla app) which all continue to
// deploy as plain static files with no build step. Run with
// `npm run admin:dev` / `npm run admin:build`.
export default defineConfig({
  root: 'admin-app',
  plugins: [react(), quoteToolBridge()],
  build: {
    outDir: '../admin-app-dist',
    emptyOutDir: true,
  },
});
