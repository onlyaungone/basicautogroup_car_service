const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

const { PORT } = require('./src/config');
const { initDb } = require('./src/database');
const { handleServices } = require('./src/api/services');
const { handleAvailability } = require('./src/api/availability');
const { handleBookings } = require('./src/api/bookings');
const { resolvePublicPath, sendFile } = require('./src/utils/response');

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const { pathname, query } = parsedUrl;

  if (pathname === '/api/services' && req.method === 'GET') {
    return handleServices(req, res);
  }

  if (pathname === '/api/availability' && req.method === 'GET') {
    return handleAvailability(query, res);
  }

  if (pathname === '/api/bookings' && req.method === 'POST') {
    return handleBookings(req, res);
  }

  const filePath = resolvePublicPath(pathname);
  if (fs.existsSync(filePath)) {
    return sendFile(res, filePath);
  }

  res.writeHead(404);
  res.end('Not found');
});

initDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`BASIC.AUTOGROUP car service app running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
