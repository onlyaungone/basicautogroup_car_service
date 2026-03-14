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

async function ensureColumn(table, name, definition) {
  const columns = await all(`PRAGMA table_info(${table})`);
  if (!columns.some(column => column.name === name)) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}

async function migrateAppointmentsTable() {
  const legacy = await get(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'appointments_legacy'`);
  const existing = await get(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'appointments'`);

  if (existing && existing.sql && existing.sql.includes('UNIQUE(date, time)') && !legacy) {
    await run(`ALTER TABLE appointments RENAME TO appointments_legacy`);
  }

  const hasLegacy = await get(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'appointments_legacy'`);
  if (!hasLegacy) {
    return;
  }

  await run(`DROP TABLE IF EXISTS appointments`);
  await run(`CREATE TABLE appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    pickupDate TEXT,
    pickupTime TEXT,
    services TEXT NOT NULL,
    subtotal REAL NOT NULL,
    tax REAL NOT NULL,
    discount REAL NOT NULL,
    total REAL NOT NULL,
    lateChangeFee REAL NOT NULL DEFAULT 0,
    promoCode TEXT,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    addressLine1 TEXT,
    addressLine2 TEXT,
    suburb TEXT,
    stateRegion TEXT,
    postcode TEXT NOT NULL,
    vehicle TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'booked',
    cancellationAgreed INTEGER NOT NULL,
    cancelledAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT,
    FOREIGN KEY(userId) REFERENCES users(id)
  )`);
  const legacyColumns = await all(`PRAGMA table_info(appointments_legacy)`);
  const sourceNames = new Set(legacyColumns.map(column => column.name));
  const selectValue = (name, fallback) => (sourceNames.has(name) ? name : fallback);
  await run(`INSERT INTO appointments (
    id, userId, date, time, pickupDate, pickupTime, services, subtotal, tax, discount, total, lateChangeFee,
    promoCode, firstName, lastName, email, phone, addressLine1, addressLine2, suburb, stateRegion, postcode,
    vehicle, note, status, cancellationAgreed, cancelledAt, createdAt, updatedAt
  )
  SELECT
    ${selectValue('id', 'NULL')},
    ${selectValue('userId', 'NULL')},
    ${selectValue('date', "''")},
    ${selectValue('time', "''")},
    ${selectValue('pickupDate', "''")},
    ${selectValue('pickupTime', "''")},
    ${selectValue('services', "'[]'")},
    ${selectValue('subtotal', '0')},
    ${selectValue('tax', '0')},
    ${selectValue('discount', '0')},
    ${selectValue('total', '0')},
    ${selectValue('lateChangeFee', '0')},
    ${selectValue('promoCode', 'NULL')},
    ${selectValue('firstName', "''")},
    ${selectValue('lastName', "''")},
    ${selectValue('email', "''")},
    ${selectValue('phone', "''")},
    ${selectValue('addressLine1', "''")},
    ${selectValue('addressLine2', "''")},
    ${selectValue('suburb', "''")},
    ${selectValue('stateRegion', "''")},
    ${selectValue('postcode', "''")},
    ${selectValue('vehicle', 'NULL')},
    ${selectValue('note', "''")},
    ${selectValue('status', "'booked'")},
    ${selectValue('cancellationAgreed', '0')},
    ${selectValue('cancelledAt', 'NULL')},
    ${selectValue('createdAt', "''")},
    ${selectValue('updatedAt', 'NULL')}
  FROM appointments_legacy`);
  await run(`DROP TABLE appointments_legacy`);
}

async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    salt TEXT NOT NULL,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    userId INTEGER NOT NULL,
    createdAt TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    FOREIGN KEY(userId) REFERENCES users(id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    pickupDate TEXT,
    pickupTime TEXT,
    services TEXT NOT NULL,
    subtotal REAL NOT NULL,
    tax REAL NOT NULL,
    discount REAL NOT NULL,
    total REAL NOT NULL,
    lateChangeFee REAL NOT NULL DEFAULT 0,
    promoCode TEXT,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    addressLine1 TEXT,
    addressLine2 TEXT,
    suburb TEXT,
    stateRegion TEXT,
    postcode TEXT NOT NULL,
    vehicle TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'booked',
    cancellationAgreed INTEGER NOT NULL,
    cancelledAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT,
    FOREIGN KEY(userId) REFERENCES users(id)
  )`);

  await migrateAppointmentsTable();

  await ensureColumn('appointments', 'userId', 'INTEGER');
  await ensureColumn('appointments', 'pickupDate', 'TEXT');
  await ensureColumn('appointments', 'pickupTime', 'TEXT');
  await ensureColumn('appointments', 'lateChangeFee', 'REAL NOT NULL DEFAULT 0');
  await ensureColumn('appointments', 'addressLine1', 'TEXT');
  await ensureColumn('appointments', 'addressLine2', 'TEXT');
  await ensureColumn('appointments', 'suburb', 'TEXT');
  await ensureColumn('appointments', 'stateRegion', 'TEXT');
  await ensureColumn('appointments', 'vehicle', 'TEXT');
  await ensureColumn('appointments', 'status', `TEXT NOT NULL DEFAULT 'booked'`);
  await ensureColumn('appointments', 'cancelledAt', 'TEXT');
  await ensureColumn('appointments', 'updatedAt', 'TEXT');

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
