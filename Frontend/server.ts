import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr/node';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import bootstrap from './src/main.server';

// Allowed hostnames for production (prevents CORS errors)
const ALLOWED_HOSTS = [
  'localhost',
  '127.0.0.1',
  'rohit-nair296.onrender.com', // Your production domain
  // Add more domains as needed
];

// The Express app is exported so that it can be used by serverless Functions.
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

  // Example Express Rest API endpoints
  // server.get('/api/**', (req, res) => { });
  // Serve static files from /browser
  server.get('*.*', express.static(browserDistFolder, {
    maxAge: '1y'
  }));

  // All regular routes use the Angular engine
  server.get('*', (req, res, next) => {
    const { protocol, originalUrl, baseUrl, headers } = req;
    const host = headers.host || '';

    // Validate hostname to prevent CORS errors
    const isAllowedHost = ALLOWED_HOSTS.some(allowedHost => 
      host.includes(allowedHost)
    );

    if (!isAllowedHost && process.env['NODE_ENV'] === 'production') {
      console.warn(`⚠️ Blocked request from unauthorized host: ${host}`);
      res.status(403).send('Forbidden: Invalid host');
      return;
    }

    // Set timeout for SSR rendering (30 seconds)
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

function run(): void {
  const port = process.env['PORT'] || 4000;

  // Start up the Node server
  const expressApp = app();
  
  // ✅ Capture the HTTP server instance (not Express app)
  const httpServer = expressApp.listen(port, () => {
    console.log(`✅ Node Express server listening on http://localhost:${port}`);
    console.log(`📦 Environment: ${process.env['NODE_ENV'] || 'development'}`);
    console.log(`🌐 Allowed hosts: ${ALLOWED_HOSTS.join(', ')}`);
  });
  
  // ✅ Set timeout on HTTP server instance
  httpServer.setTimeout(60000); // 60 seconds
}

run();
