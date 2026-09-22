import { createReadStream } from 'node:fs';
import { copyFile, cp, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const legacyStaticFiles = [
  ['quote-tool/index.html', 'quote-tool/index.html'],
  ['portal/index.html', 'portal/index.html'],
  ['portal/signup.html', 'portal/signup.html'],
  ['portal/set-password.html', 'portal/set-password.html'],
  ['portal/dashboard.html', 'portal/dashboard.html'],
  ['portal/certificate.html', 'portal/certificate.html'],
  ['css/survey.css', 'css/survey.css'],
  ['css/admin.css', 'css/admin.css'],
  ['css/portal.css', 'css/portal.css'],
  ['css/quote-tool.css', 'css/quote-tool.css'],
  ['js/config.js', 'js/config.js'],
  ['js/portal.js', 'js/portal.js'],
  ['js/quote-tool.js', 'js/quote-tool.js'],
  ['assets/favicon.png', 'assets/favicon.png'],
  ['assets/gg-shield.png', 'assets/gg-shield.png'],
  ['assets/logo-color.png', 'assets/logo-color.png'],
  ['assets/logo-white.png', 'assets/logo-white.png'],
];

const legacyStaticDevFiles = new Map(legacyStaticFiles.map(([source, target]) => [`/${target}`, source]));
const mimeType = (file) => ({ '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png' })[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream';

// The client portal, Quotes/Invoices/Receipts, and Resource Library remain
// standalone static experiences. This bridge keeps them reachable in dev
// and includes their required files in the standalone build.
function legacyStaticBridge() {
  return {
    name: 'legacy-static-bridge',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        const source = legacyStaticDevFiles.get(pathname);
        const resourcePath = pathname === '/resources' || pathname === '/resources/'
          ? 'resources/index.html'
          : pathname.startsWith('/resources/') ? `resources/${pathname.slice('/resources/'.length)}` : null;
        const sourcePath = source ? resolve(source) : resourcePath ? resolve(resourcePath) : null;
        if (!sourcePath || (resourcePath && !sourcePath.startsWith(`${resolve('resources')}/`))) return next();
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
      await Promise.all(legacyStaticFiles.map(async ([source, target]) => {
        const targetPath = resolve(outDir, target);
        await mkdir(dirname(targetPath), { recursive: true });
        await copyFile(resolve(source), targetPath);
      }));
      await cp(resolve('resources'), resolve(outDir, 'resources'), { recursive: true });
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
  plugins: [react(), legacyStaticBridge()],
  build: {
    outDir: '../admin-app-dist',
    emptyOutDir: true,
  },
});
