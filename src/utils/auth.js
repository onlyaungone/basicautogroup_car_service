const { parseCookies, setCookie } = require('./cookies');
const { getSessionById, getUserById, deleteExpiredSessions, deleteSession } = require('../repositories/usersRepository');

const SESSION_COOKIE = 'basicauto_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

async function getCurrentUser(req) {
  await deleteExpiredSessions();
  const cookies = parseCookies(req.headers.cookie || '');
  const sessionId = cookies[SESSION_COOKIE];
  if (!sessionId) return null;
  const session = await getSessionById(sessionId);
  if (!session || session.expiresAt <= new Date().toISOString()) {
    return null;
  }
  return getUserById(session.userId);
}

function setSessionCookie(res, token) {
  setCookie(res, SESSION_COOKIE, token, {
    path: '/',
    maxAge: SESSION_MAX_AGE,
    sameSite: 'Lax'
  });
}

async function clearSession(req, res) {
  const cookies = parseCookies(req.headers.cookie || '');
  const sessionId = cookies[SESSION_COOKIE];
  if (sessionId) {
    await deleteSession(sessionId);
  }
  setCookie(res, SESSION_COOKIE, '', { path: '/', maxAge: 0, sameSite: 'Lax' });
}

module.exports = {
  getCurrentUser,
  setSessionCookie,
  clearSession,
  SESSION_MAX_AGE
};
