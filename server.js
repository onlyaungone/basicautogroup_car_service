const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

const { PORT } = require('./src/config');
const { initDb } = require('./src/database');
const { handleServices } = require('./src/api/services');
const { handleAvailability } = require('./src/api/availability');
const { handleBookings } = require('./src/api/bookings');
const { handleSignUp, handleSignIn, handleSignOut, handleMe } = require('./src/api/auth');
const {
  handleAppointmentsList,
  handleAppointmentDetail,
  handleAppointmentCancel,
  handleAppointmentReschedule
} = require('./src/api/appointments');
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

  if (pathname === '/api/auth/signup' && req.method === 'POST') {
    return handleSignUp(req, res);
  }

  if (pathname === '/api/auth/signin' && req.method === 'POST') {
    return handleSignIn(req, res);
  }

  if (pathname === '/api/auth/signout' && req.method === 'POST') {
    return handleSignOut(req, res);
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    return handleMe(req, res);
  }

  if (pathname === '/api/appointments' && req.method === 'GET') {
    return handleAppointmentsList(req, res);
  }

  const appointmentMatch = pathname.match(/^\/api\/appointments\/(\d+)$/);
  if (appointmentMatch && req.method === 'GET') {
    return handleAppointmentDetail(req, res, Number(appointmentMatch[1]));
  }

  const cancelMatch = pathname.match(/^\/api\/appointments\/(\d+)\/cancel$/);
  if (cancelMatch && req.method === 'POST') {
    return handleAppointmentCancel(req, res, Number(cancelMatch[1]));
  }

  const rescheduleMatch = pathname.match(/^\/api\/appointments\/(\d+)\/reschedule$/);
  if (rescheduleMatch && req.method === 'POST') {
    return handleAppointmentReschedule(req, res, Number(rescheduleMatch[1]));
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
