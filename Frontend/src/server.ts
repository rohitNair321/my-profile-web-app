// import 'zone.js/node';
// import express from 'express';
// import { join, dirname } from 'node:path';
// import { fileURLToPath } from 'node:url';
// import { angularUniversal } from '@angular/ssr/express'; // <-- Correct import

// const __dirname = dirname(fileURLToPath(import.meta.url));
// const DIST_FOLDER = join(__dirname, '../browser');
// const app = express();
// const PORT = process.env['PORT'] || 4000;

// // Serve static files
// app.use(express.static(DIST_FOLDER, { maxAge: '1y' }));

// // Use Angular SSR middleware
// app.use(angularUniversal({ distPath: DIST_FOLDER }));

// // Start the server
// app.listen(PORT, () => {
//   console.log(`Node Express server listening on http://localhost:${PORT}`);
// });
