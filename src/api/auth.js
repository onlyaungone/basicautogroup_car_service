const { parseBody } = require('../utils/body');
const { sendJson } = require('../utils/response');
const { hashPassword, verifyPassword, createToken } = require('../utils/password');
const { createUser, getUserByEmail, createSession } = require('../repositories/usersRepository');
const { setSessionCookie, clearSession, getCurrentUser, SESSION_MAX_AGE } = require('../utils/auth');

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName
  };
}

async function handleSignUp(req, res) {
  const body = await parseBody(req);
  const { firstName, lastName, email, password } = body;

  if (!firstName || !lastName || !email || !password) {
    return sendJson(res, 400, { error: 'All sign up fields are required.' });
  }

  const existing = await getUserByEmail(String(email).toLowerCase());
  if (existing) {
    return sendJson(res, 409, { error: 'An account with that email already exists.' });
  }

  const { salt, hash } = hashPassword(password);
  const result = await createUser({
    firstName,
    lastName,
    email: String(email).toLowerCase(),
    passwordHash: hash,
    salt
  });

  const token = createToken();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();
  await createSession({ id: token, userId: result.lastID, createdAt, expiresAt });
  setSessionCookie(res, token);

  return sendJson(res, 201, {
    user: publicUser({
      id: result.lastID,
      email: String(email).toLowerCase(),
      firstName,
      lastName
    })
  });
}

async function handleSignIn(req, res) {
  const body = await parseBody(req);
  const { email, password } = body;
  const user = await getUserByEmail(String(email || '').toLowerCase());

  if (!user || !verifyPassword(password || '', user.salt, user.passwordHash)) {
    return sendJson(res, 401, { error: 'Invalid email or password.' });
  }

  const token = createToken();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();
  await createSession({ id: token, userId: user.id, createdAt, expiresAt });
  setSessionCookie(res, token);

  return sendJson(res, 200, { user: publicUser(user) });
}

async function handleSignOut(req, res) {
  await clearSession(req, res);
  return sendJson(res, 200, { ok: true });
}

async function handleMe(req, res) {
  const user = await getCurrentUser(req);
  return sendJson(res, 200, { user: publicUser(user) });
}

module.exports = {
  handleSignUp,
  handleSignIn,
  handleSignOut,
  handleMe
};
