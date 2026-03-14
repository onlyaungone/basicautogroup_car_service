const fs = require('fs');
const path = require('path');
const { PUBLIC_DIR } = require('../config');

const PAGE_ROUTES = new Set([
  'index',
  'services',
  'schedule',
  'checkout',
  'confirmation',
  'account',
  'appointments',
  'appointment',
  'about',
  'store'
]);

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    }[ext] || 'text/plain';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

function resolvePublicPath(pathname) {
  if (pathname === '/') {
    return path.join(PUBLIC_DIR, 'index.html');
  }

  const normalized = pathname.replace(/^\/+/, '');
  const routeName = normalized.endsWith('.html') ? normalized.slice(0, -5) : normalized;
  const mappedPath = PAGE_ROUTES.has(routeName)
    ? path.join(PUBLIC_DIR, `${routeName}.html`)
    : path.join(PUBLIC_DIR, normalized);

  const filePath = mappedPath;
  if (filePath.startsWith(PUBLIC_DIR) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return filePath;
  }
  return path.join(PUBLIC_DIR, 'index.html');
}

module.exports = {
  sendJson,
  sendFile,
  resolvePublicPath
};
