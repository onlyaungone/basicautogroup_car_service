const sqlite3 = require('sqlite3').verbose();
const { DB_PATH, defaultServices } = require('./config');

const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    services TEXT NOT NULL,
    subtotal REAL NOT NULL,
    tax REAL NOT NULL,
    discount REAL NOT NULL,
    total REAL NOT NULL,
    promoCode TEXT,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    postcode TEXT NOT NULL,
    note TEXT,
    cancellationAgreed INTEGER NOT NULL,
    createdAt TEXT NOT NULL,
    UNIQUE(date, time)
  )`);

  const countRow = await get('SELECT COUNT(*) as count FROM services');
  if (!countRow || countRow.count === 0) {
    const insert = db.prepare('INSERT INTO services (id, name, description, price) VALUES (?, ?, ?, ?)');
    defaultServices.forEach(service => insert.run(service.id, service.name, service.description, service.price));
    insert.finalize();
  }
}

module.exports = {
  db,
  run,
  all,
  get,
  initDb
};
