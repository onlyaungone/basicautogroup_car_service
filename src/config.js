const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'app.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

const defaultServices = [
  { id: 1, name: 'Full Service', description: 'Comprehensive inspection, oil change, filters, and fluid top-up.', price: 280 },
  { id: 2, name: 'Logbook Service', description: 'Manufacturer guideline service with genuine parts where required.', price: 220 },
  { id: 3, name: 'Brake Inspection & Pads', description: 'Brake health check with pad replacement where needed.', price: 180 },
  { id: 4, name: 'Tyre Rotation & Balance', description: 'Rotation, balancing, and pressure check for even tyre wear.', price: 95 },
  { id: 5, name: 'Air Conditioning Clean', description: 'System clean, cabin filter check, and deodorising treatment.', price: 140 }
];

module.exports = {
  ROOT_DIR,
  PORT,
  PUBLIC_DIR,
  DATA_DIR,
  DB_PATH,
  defaultServices
};
