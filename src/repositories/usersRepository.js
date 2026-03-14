const { all, get, run } = require('../database');

async function createUser(user) {
  return run(
    `INSERT INTO users (email, passwordHash, salt, firstName, lastName, createdAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [user.email, user.passwordHash, user.salt, user.firstName, user.lastName, new Date().toISOString()]
  );
}

async function getUserByEmail(email) {
  return get(`SELECT * FROM users WHERE email = ?`, [email]);
}

async function getUserById(id) {
  return get(`SELECT * FROM users WHERE id = ?`, [id]);
}

async function createSession(session) {
  return run(
    `INSERT INTO sessions (id, userId, createdAt, expiresAt) VALUES (?, ?, ?, ?)`,
    [session.id, session.userId, session.createdAt, session.expiresAt]
  );
}

async function getSessionById(id) {
  return get(`SELECT * FROM sessions WHERE id = ?`, [id]);
}

async function deleteSession(id) {
  return run(`DELETE FROM sessions WHERE id = ?`, [id]);
}

async function deleteExpiredSessions() {
  return run(`DELETE FROM sessions WHERE expiresAt <= ?`, [new Date().toISOString()]);
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  createSession,
  getSessionById,
  deleteSession,
  deleteExpiredSessions
};
