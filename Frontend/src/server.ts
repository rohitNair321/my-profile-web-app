import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr/node';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import bootstrap from './main.server';

const ALLOWED_HOSTS = [
  'localhost',
  '127.0.0.1',
  'rohitnair-dev.onrender.com',
];

export function app(): express.Express {
  const server = express();
  const serverDistFolder = dirname(fileURLToPath(import.meta.url));
  const browserDistFolder = resolve(serverDistFolder, '../browser');
  const indexHtml = join(serverDistFolder, 'index.server.html');

  const commonEngine = new CommonEngine();

  server.set('view engine', 'html');
  server.set('views', browserDistFolder);

  // CORS middleware for SSR
  server.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      const isAllowed = ALLOWED_HOSTS.some(host =>
        origin === `https://${host}` ||
        origin === `http://${host}` ||
        origin === `http://${host}:4200` ||
        origin === `http://${host}:3000`
      );
      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      }
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Lightweight liveness endpoint — declared BEFORE the static/SSR handlers so a
  // keep-warm ping returns instantly without rendering Angular (and bypasses the
  // host allow-list check on the catch-all route).
  server.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // Serve static files from /browser
  server.get('*.*', express.static(browserDistFolder, {
    maxAge: '1y'
  }));

  // All regular routes use the Angular engine
  server.get('*', (req, res, next) => {
    const { protocol, originalUrl, baseUrl, headers } = req;
    const host = headers.host || '';

    const isAllowedHost = ALLOWED_HOSTS.some(allowedHost =>
      host.includes(allowedHost)
    );

    if (!isAllowedHost && process.env['NODE_ENV'] === 'production') {
      console.warn(`⚠️ Blocked request from unauthorized host: ${host}`);
      res.status(403).send('Forbidden: Invalid host');
      return;
    }

    const renderTimeout = setTimeout(() => {
      console.error('⏱️ SSR render timeout for:', originalUrl);
      if (!res.headersSent) {
        res.status(504).send('Request timeout');
      }
    }, 30000);

    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url: `${protocol}://${host}${originalUrl}`,
        publicPath: browserDistFolder,
        providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
        inlineCriticalCss: true,
      })
      .then((html) => {
        clearTimeout(renderTimeout);
        if (!res.headersSent) {
          res.send(html);
        }
      })
      .catch((err) => {
        clearTimeout(renderTimeout);
        console.error('❌ SSR render error:', err);
        if (!res.headersSent) {
          next(err);
        }
      });
  });

  return server;
}

/**
 * Keep-warm self-ping — defeats Render free-tier cold starts for the SSR service.
 * Render sleeps after ~15 min with no inbound HTTP; pinging our own public /health
 * every 14 min keeps an already-awake instance awake. It cannot wake a slept
 * instance (nothing runs to fire it) — pair with an external monitor for that.
 * Needs the public URL: SELF_PING_URL, or Render's auto-injected RENDER_EXTERNAL_URL.
 */
function startKeepWarm(): void {
  if (process.env['NODE_ENV'] !== 'production') return;

  const base = process.env['SELF_PING_URL'] || process.env['RENDER_EXTERNAL_URL'];
  if (!base) {
    console.log('🔥 Frontend keep-warm disabled — set SELF_PING_URL or RENDER_EXTERNAL_URL');
    return;
  }
  if (typeof fetch !== 'function') {
    console.warn('🔥 Frontend keep-warm disabled — global fetch unavailable (needs Node 18+)');
    return;
  }

  const target = `${base.replace(/\/+$/, '')}/health`;
  const FOURTEEN_MIN = 14 * 60 * 1000;

  setInterval(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(target, { method: 'GET', signal: controller.signal });
      clearTimeout(timeout);
      console.log(`🔥 Keep-warm ping ${target} → ${res.status}`);
    } catch (err) {
      console.warn('🔥 Keep-warm ping failed:', (err as Error).message);
    }
  }, FOURTEEN_MIN).unref(); // unref so the timer never blocks process exit

  console.log(`🔥 Frontend keep-warm started — pinging ${target} every 14 min`);
}

function run(): void {
  const port = process.env['PORT'] || 4000;

  const expressApp = app();
  const httpServer = expressApp.listen(port, () => {
    console.log(`✅ Node Express server listening on http://localhost:${port}`);
    console.log(`📦 Environment: ${process.env['NODE_ENV'] || 'development'}`);
    console.log(`🌐 Allowed hosts: ${ALLOWED_HOSTS.join(', ')}`);
    startKeepWarm();
  });

  httpServer.setTimeout(60000);
}

run();
